<?php
		if(isset($_POST['submit'])){
			if($_POST['un'] == "kikker" && $_POST['pw'] == "kikker")
			{				
				echo "<p>you are logged in</p>";
				echo "<a href='kikkers.php?page=kikkers'>Uncover the vault</a>";
                $_SESSION['loggedIn'] = true;
			}
			else{
				echo "<p style='color: red;'>wrong username and/or password</p>";
				include("login.html");
			}
		}
		else{
			echo "Log in aub!";
			include("login.html");
		}
	?>
