<?php
/**
 * GET -> Deepak's YouTube uploads, newest first, sorted into instruments.
 * The list is cached on the server (see youtube.cache_minutes in config.php).
 */
require dirname(__DIR__) . '/lib/bootstrap.php';
require TST_ROOT . '/lib/youtube.php';

$videos = array_map(fn ($v) => [
    'id'       => $v['id'],
    'title'    => $v['title'],
    'category' => $v['category'],
    'level'    => $v['level'],
    'duration' => $v['duration'],
], youtube_videos());

json_response(['ok' => true, 'videos' => $videos]);
