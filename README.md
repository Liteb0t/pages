# Pages
Javascript library to display HTML as pages. Can serve as a starting point for a proper document editor.

## setup
You are required to have at least the following in the HTML:
```html
<link rel="stylesheet" href="pages-styles.css" />

<div id="fuze-pages" class="pages-frame">
	<div class="page-container">
		<div class="page" id="page-1">
			<div class="header"></div>
			<div class="main">
				<div class="content" id="page1content" contenteditable="true">
			</div>
			</div>
			<div class="footer"></div>
		</div>
	</div>
</div>
<script src="fuze-pages/fuze-pages.js"></script>
```
Initialise a Fuze Pages container and provide the ID of the page frame:
```javascript
const fuze_pages = new Pages("fuze-pages");
```
View the example files for more options.
