# Pages
Javascript library to display HTML as pages. Can serve as a starting point for a proper document editor.

## Quick start
Here is the minimum amount of code required to start up Fuze Pages:
```html
<link rel="stylesheet" href="pages-styles.css" />
<div id="fuze-pages" class="pages-frame"></div>
<script src="fuze-pages.js"></script>
<script>
const fuze_pages = new Pages("fuze-pages");
</script>
```

## Config
Default values:
```javascript
{
	"page_data_source": "none",
	"page_modules": [],
	"image_module_default_url": "https://fuze.page/images/fuze-min.png",
	"zoom_enabled": true
	"frame_defined_as_element": false,
	"single_page_mode": false,
	"minimum_zoom": 0.4
}
```
Example configuration from pages.html:
```javascript
const pages_demo = new Pages("page-frame", {
	"page_modules": [
		{
			"location": "header",
			"title": "Page Number",
			"type": "page_number",
			"start_page": 0,
			"end_page": "end",
			"first_number": 1,
			"id": 0,
			"styles": {
				"align": "Left",
				"vertical_margin_number": 10,
				"vertical_margin_unit": "px",
				"side_margin_number": 10,
				"side_margin_unit": "px"
			}
		},
		{
			"location": "header",
			"type": "text",
			"start_page": 0,
			"end_page": "end",
			"content": "<h3>Hello World</h3>",
			"id": 0,
			"styles": {
				"align": "Center",
				"vertical_margin_number": 8,
				"vertical_margin_unit": "px",
				"side_margin_number": 10,
				"side_margin_unit": "px"
			}
		}
	],
	"image_module_default_url": "https://fuze.page/images/fuze-min.png",
	"page_data_source": "within_frame"
});
```
## Events
You can add event listeners for the following:
`onnewpage`, `onpagecontentfocus`, `ondeletepage`

## Miscellaneous functions
Pages.`save()` \
Downloads the pages into a stripped-down HTML file. Warning: not very tested.

Pages.`toggleSinglePageMode()`|`enableSinglePageMode()`|`disableSinglePageMode()` \
Switches between the default multiple-page mode, and the single-page mode with headers and footers hidden.

`new Page(pages_container, config = {})` \
Where `pages_container` is an instance of `Pages`.
Default values for `config` are:
```javascript
{
	"element": "new",
	"page_number": -1,
	"is_single_page": false,
	"is_anchored": false
}
```

Page.`delete()` \
What do you expect?

## Notes
- The zoom feature uses shift + mouse scroll. This overrides horizontal scrolling which is why you might want to disable it.
- This is NOT a rich text editor, as that is outside the scope of this project. Rather, this is a starting point for developers to make their own WYSIWYG editors
- The last line of code is `// export default Pages`. You can uncomment this to use it as a module.
