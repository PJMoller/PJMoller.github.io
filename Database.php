<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio</title>
    <link rel="icon" href="./img/frog-spinning.gif" type="image/gif"/>
    <link rel="stylesheet" href="./CSS/style.css">
</head>
<body>
    <header>
        <div class="logo">
            <a href="index.html"><img src="./img/logo.jpg" alt="Logo"></a>
            <h1>Peter's portfolio!</h1>
        </div>    
            <nav>
                <ul>
                    <li><a href="PS.html">PS</a></li>
                    <li><a href="Database.php">Databases</a></li>
                </ul>
            </nav>
    </header>  
    <main>
        <h2>Give me an image!</h2>
    <!-- form TAB enctype:multipart/form-data TAB -->
    <form action="upload.php" method="post" enctype="multipart/form-data">
        Select File to Upload (Max 3MB):<br>
        <!-- input:file TAB -->
        <input type="file" name="file" accept=".png, .jpeg, .jpg, .gif" />
        <br><br>
        <!-- inpute:submit TAB -->
        <input type="submit" value="Upload File" />
    </form>
    </main>

    <footer>


    </footer>



</body>
</html>