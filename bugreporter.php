<?php
$dbHandler = null;
function printError(String $err)
{
    echo "<h1>The following error occured</h1>
        <p>{$err}</p>";
}

if($_SERVER["REQUEST_METHOD"] == "POST")
{
    $product = $_POST["product"];
    $version = $_POST["version"];
    $hardware = $_POST["hardware"];
    $OS = $_POST["OS"];
    $frequency = $_POST["frequency"];
    $solution = $_POST["solution"];
    
    if($product && $version && $hardware && $OS && $frequency && $solution){
        try
        {
            $dbHandler = new PDO("mysql:host=localhost;dbname=bugreporter;", "root", "qwerty");
        }
        catch(Exception $ex)
        {
            printError($ex);
        }
        if($dbHandler){
            try{
                $stmt = $dbHandler->prepare("INSERT INTO `bugs` (`BugID`, `Product`, `Version`, `Hardware`, `OS`, `Frequency`, `Solution`) 
                                             VALUES (NULL, :product, :version, :hardware, :OS, :frequency, :solution);"
                                        );
                $stmt->bindParam("product", $product, PDO::PARAM_STR);
                $stmt->bindParam("version", $version, PDO::PARAM_STR);
                $stmt->bindParam("hardware", $hardware, PDO::PARAM_STR);
                $stmt->bindParam("OS", $OS, PDO::PARAM_STR);
                $stmt->bindParam("frequency", $frequency, PDO::PARAM_STR);
                $stmt->bindParam("solution", $solution, PDO::PARAM_STR);
                $stmt->execute(); 
                echo "Query executed! {$stmt->rowCount()} row(s) affected<br>";
                echo "<a href=bugshower.php>Show all bugs</a>";
            }catch(Exception $ex) {
                printError($ex);
            }
        }


}
    else
    {
        echo "vul alles in aub";
        include "bugreporter.html";
    }
}