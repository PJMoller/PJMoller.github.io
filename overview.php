<!DOCTYPE html>
<html>
<head>
    <title>File Overview</title>
    <style>
        table {
            border-collapse: collapse;
            width: 50%;
        }

        table, th, td {
            border: 1px solid black;
        }

        th, td {
            padding: 8px;
            text-align: left;
        }
    </style>
</head>
<body>
    <h1>File Overview</h1>
    <h2>JPEG Files</h2>
    <?php
    // glob checks with the star for everything thats in uplouds/ with the .jpeg extention.
    $jpegFiles = glob("uploads/*.jpeg");
    echo "<table>";
    echo "<tr><th>File Name</th><th>Actions</th></tr>";
    // foreach jpeg file it makes an echo and displays the name and a link that directs you to the delete.php.
    foreach ($jpegFiles as $file) {
        echo "<tr><td>" . basename($file) . "</td><td><a href='delete.php?file=" . $file . "'>Delete</a></td></tr>";
    }
    echo "</table>";
    ?>

    <h2>PNG Files</h2>
    <?php
    $pngFiles = glob("uploads/*.png");
    echo "<table>";
    echo "<tr><th>File Name</th><th>Actions</th></tr>";
    foreach ($pngFiles as $file) {
        echo "<tr><td>" . basename($file) . "</td><td><a href='delete.php?file=" . $file . "'>Delete</a></td></tr>";
    }
    echo "</table>";
    ?>
	
    <h2>JPG</h2>
    <?php
    $pngFiles = glob("uploads/*.jpg");
    echo "<table>";
    echo "<tr><th>File Name</th><th>Actions</th></tr>";
    foreach ($pngFiles as $file) {
        echo "<tr><td>" . basename($file) . "</td><td><a href='delete.php?file=" . $file . "'>Delete</a></td></tr>";
    }
    echo "</table>";
    ?>	

    <h2>GIF</h2>
    <?php
    $pngFiles = glob("uploads/*.gif");
    echo "<table>";
    echo "<tr><th>File Name</th><th>Actions</th></tr>";
    foreach ($pngFiles as $file) {
        echo "<tr><td>" . basename($file) . "</td><td><a href='delete.php?file=" . $file . "'>Delete</a></td></tr>";
    }
    echo "</table>";
    ?>	

</body>
</html>
