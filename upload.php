<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    if (isset($_FILES["file"])) {
        $file = $_FILES["file"];
        $allowedExtensions = array("png", "jpeg", "jpg", "gif");
        $fileExtension = pathinfo($file["name"], PATHINFO_EXTENSION);
        if (!in_array($fileExtension, $allowedExtensions)) {
            die("Invalid file type");
        }
        if ($file['size'] > 3 * 1024 * 1024) {
            die("Your file is bigger then 3mb");
        }
        // !preg_match checks if your file name do not matches the characters you specify on the left.
        if(strlen($file["name"]) > 50 || !preg_match('/[A-Z]/', $file["name"])) {
            die("File name too long or you need atleast one uppercase letter.");
        }
        $uploadPath = "uploads/";
        $newFilename = $file["name"];
        // combines our made variables into 1 new variable so it automaticly places the upload path before the name to store it correctly.
        $destination = $uploadPath . $newFilename;

        // move the file from the temporary location and temporary name to our new place, uploads/ wich we can find in the root.
        if (move_uploaded_file($file["tmp_name"], $destination)) 
		{
            // fires code when the file got moved to the destination.
            echo "File uploaded successfully!<br>";
        } else {
            // fires code when the file did NOT moved to the destination.
            echo "File upload failed.";
        }

    }
    else {
        echo "No file uploaded.";
    }
}
?>

<a href="overview.php">See all files</a>