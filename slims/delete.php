<?php
// http:delete?file=abc.def
// deletes file files/abc.def
// Written by Wm Leler

$file = htmlspecialchars($_GET['file']);
$filepath = 'files/'.$file;
@unlink($filepath);
?>