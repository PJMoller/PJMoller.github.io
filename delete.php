<?php
// checks if the request method is get and if there is a file with the request.
if ($_SERVER["REQUEST_METHOD"] == "GET" && isset($_GET["file"])) 
{
    // sets the file you get from the get request to a variable so you don't have to write $_GET["file"] everytime 
    $file = $_GET["file"];

    // Checks if the file exists
    if (file_exists($file)) 
	{
        // unlinks the file
        if (unlink($file)) 
		{
            // Fires code when the file is unlinked.
            echo "File deleted successfully!";
        } 
		else 
		{   
            // Fires code when the file is not unlinked.
            echo "Failed to delete the file.";
        }
    } 
	else 
	{
        // Fires code when the file is not in the request.
        echo "File not found.";
    }
}
?>