<?php
// http:delete?file=abc.def
// deletes file files/abc.def
// Written by Wm Leler

$file = htmlspecialchars($_GET['file']);
$filepath = 'files/'.$file;
if (unlink($filepath)) {
	echo $filepath.' deleted';
} else {
	header("HTTP/1.0 404 Not Found");
}
?>