<?php
/**
 * Pulls the channel's uploads from the YouTube Data API v3 and caches them on disk,
 * so the site asks YouTube at most once per cache period (well inside the free quota).
 */

function youtube_configured(): bool
{
    return (string) config('youtube.api_key') !== '' && (string) config('youtube.channel_id') !== '';
}

function youtube_get(string $endpoint, array $params): ?array
{
    $base = rtrim((string) config('youtube.api_base', 'https://www.googleapis.com/youtube/v3'), '/');
    $params['key'] = config('youtube.api_key');
    $ch = curl_init($base . '/' . $endpoint . '?' . http_build_query($params));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false || $status !== 200) {
        write_log('youtube.log', ['event' => 'request_failed', 'endpoint' => $endpoint, 'status' => $status]);
        return null;
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

/** ISO 8601 duration (PT4M13S) → "4:13". */
function youtube_duration(string $iso): array
{
    if (!preg_match('/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/', $iso, $m)) {
        return ['', 0];
    }
    $secs = ((int) ($m[1] ?? 0)) * 86400 + ((int) ($m[2] ?? 0)) * 3600 + ((int) ($m[3] ?? 0)) * 60 + (int) ($m[4] ?? 0);
    $h = intdiv($secs, 3600);
    $mm = intdiv($secs % 3600, 60);
    $ss = $secs % 60;
    $label = $h > 0 ? sprintf('%d:%02d:%02d', $h, $mm, $ss) : sprintf('%d:%02d', $mm, $ss);
    return [$label, $secs];
}

/** Guess instrument and level from the video's title and description. */
function youtube_classify(string $title, string $description): array
{
    $t = mb_strtolower($title);
    $d = mb_strtolower(mb_substr($description, 0, 400));
    $rules = [
        'Ukulele' => '/\b(ukulele|uke)\b/u',
        'Guitar'  => '/\b(guitar|chords?|strum\w*|riffs?|solo|fingerstyle|barre|fretboard|pentatonic|tabs?)\b/u',
        'Theory'  => '/\b(theory|scales?|ear training|intervals?|notation|rhythm)\b/u',
    ];
    $category = 'More';
    foreach ([$t, $d] as $text) {
        foreach ($rules as $name => $re) {
            if (preg_match($re, $text)) { $category = $name; break 2; }
        }
    }

    $level = null;
    if (preg_match('/\b(beginners?|basics?|easy|first lesson|lesson 1)\b/u', $t)) $level = 'beginner';
    elseif (preg_match('/\bintermediate\b/u', $t)) $level = 'intermediate';
    elseif (preg_match('/\b(advanced|expert)\b/u', $t)) $level = 'advanced';

    return [$category, $level];
}

function youtube_fetch_all(): ?array
{
    $channel = youtube_get('channels', ['part' => 'contentDetails', 'id' => config('youtube.channel_id')]);
    $uploads = $channel['items'][0]['contentDetails']['relatedPlaylists']['uploads'] ?? null;
    if (!$uploads) {
        return null;
    }

    $max = max(1, (int) config('youtube.max_videos', 150));
    $items = [];
    $pageToken = null;
    do {
        $params = ['part' => 'snippet,contentDetails', 'playlistId' => $uploads, 'maxResults' => 50];
        if ($pageToken) $params['pageToken'] = $pageToken;
        $page = youtube_get('playlistItems', $params);
        if (!$page) break;
        foreach ($page['items'] ?? [] as $it) {
            $sn = $it['snippet'] ?? [];
            $title = (string) ($sn['title'] ?? '');
            if ($title === 'Private video' || $title === 'Deleted video') continue;
            $id = $it['contentDetails']['videoId'] ?? ($sn['resourceId']['videoId'] ?? null);
            if (!$id) continue;
            $thumbs = $sn['thumbnails'] ?? [];
            $items[$id] = [
                'id'          => $id,
                'title'       => $title,
                'description' => (string) ($sn['description'] ?? ''),
                'published'   => $it['contentDetails']['videoPublishedAt'] ?? ($sn['publishedAt'] ?? ''),
                'thumb'       => $thumbs['high']['url'] ?? $thumbs['medium']['url'] ?? $thumbs['default']['url'] ?? "https://i.ytimg.com/vi/$id/hqdefault.jpg",
            ];
        }
        $pageToken = $page['nextPageToken'] ?? null;
    } while ($pageToken && count($items) < $max);

    $items = array_slice($items, 0, $max, true);

    // Durations come from the videos endpoint, 50 ids at a time.
    foreach (array_chunk(array_keys($items), 50) as $ids) {
        $v = youtube_get('videos', ['part' => 'contentDetails', 'id' => implode(',', $ids)]);
        foreach ($v['items'] ?? [] as $row) {
            [$label, $secs] = youtube_duration((string) ($row['contentDetails']['duration'] ?? ''));
            if (isset($items[$row['id']])) {
                $items[$row['id']]['duration'] = $label;
                $items[$row['id']]['seconds'] = $secs;
            }
        }
    }

    $videos = [];
    foreach ($items as $item) {
        [$cat, $level] = youtube_classify($item['title'], $item['description']);
        unset($item['description']);
        $item['category'] = $cat;
        $item['level'] = $level;
        $item['duration'] = $item['duration'] ?? '';
        $item['seconds'] = $item['seconds'] ?? 0;
        $videos[] = $item;
    }
    usort($videos, fn ($a, $b) => strcmp($b['published'], $a['published']));
    return $videos;
}

/** Cached list of videos, newest first. Returns [] when YouTube isn't set up or unreachable. */
function youtube_videos(): array
{
    if (!youtube_configured()) {
        return [];
    }
    $file = TST_STORAGE . '/cache/youtube.json';
    $ttl = max(5, (int) config('youtube.cache_minutes', 60)) * 60;
    $cached = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;

    if (is_array($cached) && (time() - (int) ($cached['fetched_at'] ?? 0)) < $ttl) {
        return $cached['videos'] ?? [];
    }

    $fresh = youtube_fetch_all();
    if ($fresh === null) {
        // YouTube unreachable: keep showing the last good list rather than an empty page.
        return is_array($cached) ? ($cached['videos'] ?? []) : [];
    }
    if (!is_dir(dirname($file))) {
        @mkdir(dirname($file), 0750, true);
    }
    @file_put_contents($file, json_encode(['fetched_at' => time(), 'videos' => $fresh], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    return $fresh;
}
