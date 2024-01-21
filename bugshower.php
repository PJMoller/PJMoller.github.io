<?php
$dbhandler = null;
try
{
    $dbHandler = new PDO("mysql:host=localhost;dbname=bugreporter;charset=utf8", "root", "qwerty");
}
catch(Exception $ex)
{
    printError($ex);
}
function printError(String $err){
    echo "<h1>The following error occured</h1>
          <p>{$err}</p>";
}
if($dbHandler){
    try{
        $stmt = $dbHandler->prepare("SELECT *
                                     FROM `bugs`"
                                );
        $stmt->execute();      
    }catch(Exception $ex) {
        printError($ex);
    }
}

if(isset($stmt)){
    $stmt->execute();//Because we already have a statement prepared with the result we want, we can re-use it here!


    while($result = $stmt->fetch(PDO::FETCH_ASSOC)){//We fetch every record one by one and print it
        echo "<table><tr><th>ID</th><th>Product</th><th>Version</th><th>Hardware</th><th>OS</th><th>Frequency</th><th>Solution</th>";
        echo "<tr><td>{$result["BugID"]}</td><td>{$result["Product"]}</td><td>{$result["Version"]}</td><td>{$result["Hardware"]}</td><td>{$result["OS"]}</td><td>{$result["Frequency"]}</td><td>{$result["Solution"]}</td><tr></table><br>";
        echo "<a href=bugreporter.html>Report new bug</a>";
    }
    $stmt->closeCursor();
}

?>
