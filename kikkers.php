<?php  session_start();  ?>

<!DOCTYPE html>
<html>
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=windows-1252" />
	</head>

	<body>
		<h1>Hehe geinige kikkers</h1>
		
		<?php
			//Check if there is a GET parameter
			if(isset($_GET['page'])){
				header("Location: kikkers.php");
			}
			else{
				//No GET present -> Check if user is logged in via SESSION
				if(isset($_SESSION['loggedIn'])){
					echo"<pre>";
					echo"</pre>";
					echo "<a href='index.html?page=logout'>click here to log out</a>";
					
				}
				else{
					//If SESSION['loggedIn'] has not been set -> give feedback and include login script
					echo "session not set<br /><br />";
					include("login.php");
				}
				
				
			}
		
		?>
	</body>
</html>
