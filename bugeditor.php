<?php
$dbHandler = null;
try{
    $dbHandler = new PDO("mysql:host=localhost;dbname=bugreporter;charset=utf8", "root", "qwerty");
}catch(Exception $ex){
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
    $stmt->execute();


    if($result = $stmt->fetch(PDO::FETCH_ASSOC)){
        $Product = $result["Product"];
        $Version = $result["Version"];
        $Hardware = $result["Hardware"];
        $OS = $result["OS"];
        $Frequency = $result["Frequency"];
        $Solution = $result["Solution"];
    }
    $stmt->closeCursor();
}

?>


<h1>Edit a bug</h1>
<form action="bugreporter.php" method="post">
	<table>
		<tr>
			<td>
				Product:
			</td>
			<td>
				<input type="text" name="product" value="<?php echo $Product; ?>" />
		</tr>
		<tr>
			<td>Version:</td>
			<td>
				<input type="text" name="version" value="<?php echo $Version; ?>" />
			</td>
		</tr>
		<tr>
			<td>Hardware:</td>
			<td>
				<input type="text" name="hardware" value="<?php echo $Hardware; ?>"/>
			</td>
		</tr>
		<tr>
			<td>OS:</td>
			<td>
				<input type="text" name="OS" value="<?php echo $OS; ?>" />
			</td>
		</tr>
		<tr>
			<td>Frequency:</td>
			<td>
				<input type="text" name="frequency" value="<?php echo $Frequency; ?>" />
			</td>
		</tr>
		<tr>
			<td>Solution:</td>
			<td>
				<input type="text" name="solution" value="<?php echo $Solution; ?>" />
			</td>
		</tr>
	</table>
	<input type="submit" name="submit" />
</form>