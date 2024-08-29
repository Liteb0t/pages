let page_frame_element = document.getElementById("page-frame");
let page_1 = document.getElementById("page-1"); // for testing
let test_table = document.querySelector(".test-table");

class Pages {
	static spitting_tags = ["table", "tbody", "ul", "ol"];

	constructor(frame, config_args = {}) {
		let config = {
			...{
				"page_data_source": "none",
				"page_modules": [],
				"image_module_default_url": "https://fuze.page/images/fuze-min.png",
				"zoom_enabled": true,
				"frame_defined_as_element": false
			}, ...config_args };

		if (config["frame_defined_as_element"]) {
			this.frame_element = frame;
		}
		else {
			this.frame_element = document.getElementById(frame);
		}
		this.pages = [];
		this.styles = {};
		Object.assign(this, config);
		if (this.page_data_source == "within_frame") {
			this.page_container_element = this.frame_element.querySelector(".page-container");
			for (let page_element of this.page_container_element.querySelectorAll(".page")) {
				// this.pages.push(new Page(page_element));
				new Page(this, page_element)
			}
		}
		else {
			this.page_container_element = document.createElement("div");
			this.page_container_element.classList.add("page-container");
			this.frame_element.appendChild(this.page_container_element);
			new Page(this);
		}

		this.popup_window = {
			"active": false,
			"element": document.createElement("div"),
			"content": document.createElement("div"),
			"title": document.createElement("h3"),
			"row_template": document.createElement("div"),
			"focused_page": "none",
			"modified_modules": []
		}
		this.popup_window.element.classList.add("pages-popup-window");
		this.popup_window.element.style["display"] = "none";
		this.popup_window.currently_editing = "none";
		this.popup_window.element.addEventListener("click", event => { event.stopPropagation() }); // Stop this window from closing when clicked
		this.click_off_popup_event_listener = "off";
		this.popup_window.title.classList.add("title");
		this.popup_window.content.classList.add("content");
		this.popup_window.element.appendChild(this.popup_window.title);
		this.popup_window.element.appendChild(this.popup_window.content);

		this.frame_element.appendChild(this.popup_window.element);

		["header", "footer", "modules", "page-container"].forEach(key => {
			this.styles[key] = document.createElement("style");
			this.styles[key].type = "text/css";
			console.log(document.body.appendChild(this.styles[key]));
		});
		this.styles["header"].sheet.insertRule(`
			.header {
				flex-basis: 50px;
				border: none;
			}`);
		this.styles["footer"].sheet.insertRule(`
			.footer {
				flex-basis: 50px;
				border: none;
			}`);
		this.styles["page-container"].sheet.insertRule(`
			.page-container {
				zoom: 1.0;
			}`);
		// console.log(this.styles);
		this.page_modules = [];
		for (let page_module of config.page_modules) {
			this.createPageModule(page_module);
		}

		// CSS zoom has different behaviour depending on the browser.
		// Proportions will get distorted, especially after zooming out.
		if (this.zoom_enabled) {
			this.frame_element.addEventListener("wheel", (event) => {
				if (event.shiftKey) {
					event.preventDefault(); // Disables the default functionality of shift+scroll for horizontal scrolling.
					// console.log(event.deltaY);
					let zoom_amount = -0.0003 * event.deltaY;
					// console.log(zoom_amount);
					// let zoom_rule = this.styles["page-container"].sheet.cssRules[0].style["zoom"];
					let current_zoom = Number(this.styles["page-container"].sheet.cssRules[0].style["zoom"]);
					this.styles["page-container"].sheet.cssRules[0].style["zoom"] = current_zoom + zoom_amount;
				}
			});
		}
		this.new_caret_node, this.new_caret_offset;
		this.currently_focused_content;
	}

	static pixelsToNumber(to_convert) {
		to_convert.replace("px", "");
		let converted = Number.parseFloat(to_convert);
		return converted;
	}

	static listToFragment(list) {
		let fragment = new DocumentFragment();
		for (let element of list) {
			fragment.appendChild(element);
		}
		return fragment;
	}

	static setCaretPosition(selection, node, offset) {
		// console.log("node:", node);
		// console.log("offset:", offset);
		let range = document.createRange();
		range.setStart(node, offset);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	// Rudimentary save as HTML
	// later, make the page content not contenteditable and remove header/footer CSS :hover effects.
	save() {
		let data = "<head><style>";
		for (let stylesheet of document.styleSheets) {
			for (let rule of stylesheet.cssRules) {
				if ([".page", ".header", ".footer"].indexOf(rule.selectorText) > -1) {
					data += rule.cssText;
				}
				else if (rule.type == 4 && rule.conditionText == "print") {
					data += rule.cssText;
				}
			}
		}
		for (let rule of this.styles.modules.sheet.cssRules) {
			data += rule.cssText;
		}
		data += "</head></style>";
		data += this.page_container_element.innerHTML;
		const link = document.createElement("a");
		link.setAttribute("download", "pages_document.html");
		link.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(data));
		link.click();
	}

	updateModuleStyles(page_module, style_type_arg = "all") {
		let style_types_to_update = style_type_arg == "all" ? ["vertical_margin", "horizontal_margin", "align"] : [style_type_arg];
		// console.log(style_types_to_update);
		for (let style_type of style_types_to_update) {
			if (style_type == "vertical_margin") {
				page_module.css_rule.style[`${page_module.location == "header" ? "top" : "bottom"}`] = page_module.styles.vertical_margin_number + page_module.styles.vertical_margin_unit;
			}
			else if (style_type == "horizontal_margin" || style_type == "align") {
				// console.log("yo");
				if (page_module.styles.align == "Left") {
					page_module.css_rule.style["left"] = page_module.styles.side_margin_number + page_module.styles.side_margin_unit;
					page_module.css_rule.style["right"] = "";
					page_module.css_rule.style["text-align"] = "";
				}
				else if (page_module.styles.align == "Right") {
					page_module.css_rule.style["right"] = page_module.styles.side_margin_number + page_module.styles.side_margin_unit;
					page_module.css_rule.style["left"] = "";
					page_module.css_rule.style["text-align"] = "";
				}
				else if (style_type == "align") {
					page_module.css_rule.style["text-align"] = "center";
					page_module.css_rule.style["left"] = "0";
					page_module.css_rule.style["right"] = "0";
				}
			}
			// else if (style_type == "layer") {
			// 	page_module.css_rule.style["z-index"] == page_module.styles.layer;
			// }
			// else if (style_type == "height") {
			// 	page_module.css_rule.style["z-index"] == page_module.styles.height;
			// }
		}
	}

	updatePageModule(page_module, start_page = 0, end_page = "end") {
		// console.log(page_module);
		if (end_page == "end") {
			end_page = this.pages.length - 1;
		}

		for (let i = start_page; i <= end_page; i++) {
			let page_part = this.pages[i][page_module.location]; // header or footer
			// console.log(page_part);

			let within_page_range = false;
			if (this.pages[i].page_number >= page_module.start_page && (this.pages[i].page_number <= ((page_module.end_page == "end") ? this.pages.length-1 : page_module.end_page))) {
				within_page_range = true;
			}

			// console.log(within_page_range);
			let module_element = page_part.querySelector("." + page_module.type + "_" + page_module.id);
			if (!module_element && within_page_range) {
				// console.log("creating new element" + page_module.type);
				let new_element = document.createElement("div");
				new_element.classList.add(page_module.type, page_module.type + "_" + page_module.id);
				page_part.appendChild(new_element);
				module_element = new_element;
				// if (page_module.type == "page_number") {
				// 	module_element.innerText = this.pages[i].page_number + page_module.first_number;
				// }
				// else if (page_module.type == "text") {
				// 	module_element.innerHTML = page_module.content;
				// }
			}
			else if (module_element && !within_page_range) {
				page_part.removeChild(module_element);
			}
			if (module_element && within_page_range) {
				if (page_module.type == "page_number") {
					module_element.innerText = this.pages[i].page_number + page_module.first_number;
				}
				else if (page_module.type == "text") {
					module_element.innerHTML = page_module.content;
				}
				else if (page_module.type == "image") {
					module_element.innerHTML = `<img src=${page_module.url} style="height: 100%">`;
				}
			}
		}
	}

	deletePageModule(page_module) {
		// console.log("deleting DIS page module: " + page_module.title);
		let end_page = (page_module.end_page == "end") ? this.pages.length - 1 : page_module.end_page;

		this.updatePageModule({...page_module, ...{"end_page": -1}});

		for (let i = 0; i < this.styles.modules.sheet.cssRules.length; i++) {
			if (this.styles.modules.sheet.cssRules[i].selectorText == `.${page_module.type}_${page_module.id}`) {
				this.styles.modules.sheet.deleteRule(i);
			}
		}
		this.page_modules.splice(this.page_modules.indexOf(page_module),1);
	}

	createPageModule(config_args = {}) {
		let config = { ...{
			"type": "text",
			"location": "header",
			"start_page": 0,
			"end_page": "end"
		}, ...config_args, "styles": { ...{
				"align": "Left",
				"vertical_margin_number": 5,
				"vertical_margin_unit": "px",
				"side_margin_number": 5,
				"side_margin_unit": "px"
			}, ...config_args.styles
		}
		};
		// console.log(config);

		// Assign ID
		let id = 0;
		while (true) {
			if (this.page_modules.filter( m => { m.type == config.type && m.id == ++id }).length == 0) { break }
		}
		config.id = id;

		if (!config.hasOwnProperty("title")) {
			config.title = config.type.split(" ").map(word => { return word[0].toUpperCase() + word.substring(1) }).join(" ");
			if (id > 0) {
				config.title += ` (${id})`
			}
		}

		// Start to generate CSS for the module
		let page_module_rule = [];
		page_module_rule.push(`.${config.type}_${config.id} {`);

		if (config.type == "text") {
			if (config.content === undefined) {
				config.content = "Text module";
			}
		}
		else if (config.type == "page_number") {
			if (config.first_number === undefined) {
				config.first_number = 1;
			}
		}
		else if (config.type == "image") {
			config = {
				...config,
				...{"url": this.image_module_default_url},
				"styles": {...{
					"layer": 0,
					"height": 100
				}, ...config.styles}
			}
			page_module_rule.push(`
				z-index: ${config.styles.layer};
				height: ${config.styles.height}px;`);
		}

		if (config.styles.align == "Center") {
			page_module_rule.push(`
				text-align: center;
				left: 0;
				right: 0;`);
		}
		else {
			page_module_rule.push(`${config.styles.align}: ${config.styles.side_margin_number}${config.styles.side_margin_unit};`);
		}
		page_module_rule.push(`${config.location == "header" ? "top" : "bottom"}: ${config.styles.vertical_margin_number}${config.styles.vertical_margin_unit};`);
		page_module_rule.push("}");
		config.css_rule = this.styles.modules.sheet.cssRules[this.styles.modules.sheet.insertRule(page_module_rule.join(""))];
		// console.log(config.css_rule);

		this.page_modules.push(config);
		this.updatePageModule(config);
	}

	// Generate GUI for the header/footer popup window
	openEditWindow(header_or_footer, focused_page) {
		this.popup_window.currently_editing = header_or_footer;
		this.popup_window.title.textContent = `Configure ${header_or_footer}`;
		this.popup_window.focused_page = focused_page;

		// console.log(header_or_footer);
		this.styles[header_or_footer].sheet.rules[0].style["border"] = "5px dashed #0008";

		if (this.popup_window.element.style["display"] == "flex") {
			this.popup_window.content.innerHTML = "";
			this.styles["header" == header_or_footer ? "footer" : "header"].sheet.rules[0].style["border"] = "none";
		}
		else {
			this.popup_window.element.style["display"] = "flex";
		}
		if (this.click_off_popup_event_listener == "off") {
			this.click_off_popup_event_listener = this.page_container_element.addEventListener("click", e => {
				this.closeEditWindow();
			}, {"once": true});
		}

		let settings_fieldset = document.createElement("fieldset");
		let settings_fieldset_title = document.createElement("legend");
		settings_fieldset_title.textContent = "Properties";
		settings_fieldset.appendChild(settings_fieldset_title);

		let height_select_label = document.createElement("label");
		height_select_label.htmlFor = `page_${header_or_footer}_height_select`;
		height_select_label.textContent = "Height: ";
		let height_select_input = document.createElement("input");
		height_select_input.type = "number";
		height_select_input.value = this.styles[header_or_footer].sheet.rules[0].style["flex-basis"].replaceAll(/(px|em|mm)/g, "");
		height_select_input.min = 0;
		height_select_input.id = `page_${header_or_footer}_height_select`;
		// let height_unit_label = document.createElement("label");
		// height_unit_label.htmlFor = `page_${header_or_footer}_height_unit_select`;
		// height_unit_label.textContent = "Unit: ";
		// let height_unit_menu = document.createElement("select");
		// height_unit_menu.id = `page_${header_or_footer}_height_unit_select`;
		// height_unit_menu.innerHTML = `
		// 	<option value="em">em</option>
		// 	<option value="mm">em</option>
		// 	<option value="px">px</option>
		// 	`;
		//

		settings_fieldset.appendChild(height_select_label);
		settings_fieldset.appendChild(height_select_input);
		height_select_input.addEventListener("input", event => {
			if (height_select_input.value != "") {
				// this.styles[header_or_footer].sheet.rules[0].style["flex-basis"] = height_select_input.value + height_unit_menu.value;
				this.styles[header_or_footer].sheet.rules[0].style["flex-basis"] = height_select_input.value + "px";
			}
		});

		let modules_fieldset = document.createElement("fieldset");
		let modules_fieldset_title = document.createElement("legend");
		modules_fieldset_title.textContent = "Modules";
		modules_fieldset.appendChild(modules_fieldset_title);

		for (let page_module of this.page_modules.filter(m => m.location == header_or_footer)) {
			let new_row = document.createElement("details");
			new_row.classList.add("row");
			let summary = document.createElement("summary");
			let summary_title = document.createElement("b");
			summary_title.textContent = page_module.title;
			let delete_button = document.createElement("button");
			delete_button.textContent = "Delete";
			delete_button.classList.add("delete-button");
			delete_button.onclick = (event) => {
				// event.stopPropagation();
				// console.log("calling delete for " + page_module.title);
				this.deletePageModule(page_module);
				this.openEditWindow(header_or_footer, focused_page);
			}
			summary.appendChild(summary_title);
			summary.appendChild(delete_button);
			new_row.appendChild(summary);

			new_row.alignment_select = document.createElement("div");
			let alignment_select_html = [ "Align:" ];

			["Left", "Center", "Right"].forEach(align_to => {
				alignment_select_html.push(`
					<input type="radio" name="${page_module.type}_${page_module.id}_alignment_select" id="${page_module.type}_${page_module.id}_${align_to.toLowerCase()}" value="${align_to}"`);
					alignment_select_html.push((page_module.styles.align == align_to) ? " checked>" : ">");
				alignment_select_html.push(`
					<label for="${page_module.type}_${page_module.id}_${align_to.toLowerCase()}"">${align_to}</label>`);
			});

			new_row.alignment_select.innerHTML = alignment_select_html.join("");
			for (let radio_button of new_row.alignment_select.querySelectorAll("input")) {
				radio_button.addEventListener("click", event => {
					if (radio_button.value != page_module.styles.align) {
						page_module.styles.align = radio_button.value;
						if (page_module.styles.align == "Center") {
							side_margin_input.disabled = "disabled";
						}
						else {
							side_margin_label.textContent = `${page_module.styles.align} margin: `;
							side_margin_input.disabled = "";
						}
						// this.updatePageModule(page_module, this.page_number, this.page_number);
						this.updateModuleStyles(page_module, "align");
					}
				});
			}
			new_row.appendChild(new_row.alignment_select);

			let generic_controls_table = document.createElement("table");
			generic_controls_table.cellSpacing = "0";
			let table_skeleton = [];
			let number_of_rows;
			if (page_module.type == "image") {
				number_of_rows = 3;
			}
			else {
				number_of_rows = 2;
			}
			for (let row = 0; row < number_of_rows; row++) {
				table_skeleton[row] = document.createElement("tr");
				generic_controls_table.appendChild(table_skeleton[row]);
				for (let column = 0; column <= 3; column++) {
					table_skeleton[row][column] = document.createElement("td");
					table_skeleton[row].appendChild(table_skeleton[row][column]);
				}
			}

			let vertical_margin_input = document.createElement("input");
			vertical_margin_input.size = "6";
			vertical_margin_input.type = "number";
			vertical_margin_input.value = page_module.styles.vertical_margin_number;
			vertical_margin_input.id = `${page_module.type}_${page_module.id}_vertical_margin_input`;
			let vertical_margin_label = document.createElement("label");
			vertical_margin_label.textContent = "Vertical margin: ";
			vertical_margin_label.for = `${page_module.type}_${page_module.id}_vertical_margin_input`;
			vertical_margin_input.addEventListener("input", event => {
				if (vertical_margin_input.value != "") {
					page_module.styles.vertical_margin_number = vertical_margin_input.value;
					this.updateModuleStyles(page_module, "vertical_margin");
				}
			});
			table_skeleton[0][0].appendChild(vertical_margin_label);
			table_skeleton[0][1].appendChild(vertical_margin_input);

			let side_margin_input = document.createElement("input");
			side_margin_input.size = "6";
			side_margin_input.type = "number";
			side_margin_input.value = page_module.styles.side_margin_number;
			side_margin_input.id = `${page_module.type}_${page_module.id}_side_margin_input`;
			let side_margin_label = document.createElement("label");
			if (page_module.styles.align == "Center") {
				side_margin_label.textContent = "Side margin: ";
				side_margin_input.disabled = "disabled";
			}
			else {
				side_margin_label.textContent = `${page_module.styles.align} margin: `;
			}
			side_margin_label.for = `${page_module.type}_${page_module.id}_side_margin_input`;
			side_margin_input.addEventListener("input", event => {
				if (side_margin_input.value != "") {
					page_module.styles.side_margin_number = side_margin_input.value;
					this.updateModuleStyles(page_module, "horizontal_margin");
				}
			});
			table_skeleton[0][2].appendChild(side_margin_label);
			table_skeleton[0][3].appendChild(side_margin_input);

			let start_page_input = document.createElement("input");
			start_page_input.size = "6";
			start_page_input.min = "0";
			start_page_input.type = "number";
			start_page_input.value = page_module.start_page;
			start_page_input.id = `${page_module.type}_${page_module.id}_start_page_input`;
			let start_page_label = document.createElement("label");
			start_page_label.textContent = "Start page: ";
			start_page_label.for = `${page_module.type}_${page_module.id}_start_page_input`;
			start_page_input.addEventListener("input", event => {
				if (start_page_input.value != "") {
					page_module.start_page = Number(start_page_input.value);
					this.updatePageModule(page_module);
				}
			});
			// new_row.appendChild(document.createElement("br"));
			table_skeleton[1][0].appendChild(start_page_label);
			table_skeleton[1][1].appendChild(start_page_input);

			let end_page_input = document.createElement("input");
			end_page_input.size = "6";
			// end_page_input.type = "number";
			end_page_input.value = page_module.end_page;
			end_page_input.id = `${page_module.type}_${page_module.id}_end_page_input`;
			let end_page_label = document.createElement("label");
			end_page_label.textContent = "End page: ";
			end_page_label.for = `${page_module.type}_${page_module.id}_end_page_input`;
			end_page_input.addEventListener("input", event => {
				if (end_page_input.value != "") {
					page_module.end_page = end_page_input.value == "end" ? end_page_input.value : Number(end_page_input.value);
					this.updatePageModule(page_module);
				}
			});
			table_skeleton[1][2].appendChild(end_page_label);
			table_skeleton[1][3].appendChild(end_page_input);

			new_row.appendChild(generic_controls_table);

			// Module-specific options
			if (page_module.type == "text") {
				let text_content_input = document.createElement("input");
				text_content_input.value = page_module.content;
				text_content_input.id = `${page_module.type}_${page_module.id}_text_content`;
				let text_content_label = document.createElement("label");
				text_content_label.textContent = "HTML content: ";
				text_content_label.for = `${page_module.type}_${page_module.id}_text_content`;
				text_content_input.addEventListener("input", event => {
					if (text_content_input.value != "") {
						page_module.content = text_content_input.value;
						this.updatePageModule(page_module);
					}
				});
				// new_row.appendChild(document.createElement("br"));
				new_row.appendChild(text_content_label);
				new_row.appendChild(text_content_input);
			}
			else if (page_module.type == "page_number") {
				let first_number_input = document.createElement("input");
				first_number_input.type = "number";
				first_number_input.value = page_module.first_number;
				first_number_input.id = `${page_module.type}_${page_module.id}_first_number`;
				let first_number_label = document.createElement("label");
				first_number_label.textContent = "First number: ";
				first_number_label.for = `${page_module.type}_${page_module.id}_first_number`;
				first_number_input.addEventListener("input", event => {
					if (first_number_input.value != "") {
						page_module.first_number = Number(first_number_input.value);
						this.updatePageModule(page_module);
					}
				});
				// new_row.appendChild(document.createElement("br"));
				new_row.appendChild(first_number_label);
				new_row.appendChild(first_number_input);
			}
			else if (page_module.type == "image") {
				let height_input = document.createElement("input");
				height_input.size = "6";
				height_input.min = "0";
				height_input.type = "number";
				height_input.value = page_module.styles.height;
				height_input.id = `${page_module.type}_${page_module.id}_height`;
				let height_label = document.createElement("label");
				height_label.textContent = "Size: ";
				height_label.for = `${page_module.type}_${page_module.id}_height`;
				height_input.addEventListener("input", event => {
					if (height_input.value != "") {
						page_module.styles.height = Number(height_input.value);
						page_module.css_rule.style["height"] = `${page_module.styles.height}px`;
						// this.updatePageModule(page_module);
						// this.updateModuleStyles(page_module, "height");
					}
				});
				table_skeleton[2][0].appendChild(height_label);
				table_skeleton[2][1].appendChild(height_input);

				let layer_input = document.createElement("input");
				layer_input.size = "6";
				layer_input.min = "-10";
				layer_input.max = "10";
				layer_input.type = "number";
				layer_input.value = page_module.styles.layer;
				layer_input.id = `${page_module.type}_${page_module.id}_layer`;
				let layer_label = document.createElement("label");
				layer_label.textContent = "Layer: ";
				layer_label.for = `${page_module.type}_${page_module.id}_layer`;
				layer_input.addEventListener("input", event => {
					if (layer_input.value != "") {
						page_module.styles.layer = Number(layer_input.value);
						page_module.css_rule.style["z-index"] = page_module.styles.layer;
						// this.updatePageModule(page_module);
						// this.updateModuleStyles(page_module, "layer");
					}
				});
				table_skeleton[2][2].appendChild(layer_label);
				table_skeleton[2][3].appendChild(layer_input);

				let source_url_input = document.createElement("input");
				source_url_input.size = "32";
				source_url_input.value = page_module.url;
				source_url_input.id = `${page_module.type}_${page_module.id}_source_url`;
				let source_url_label = document.createElement("label");
				source_url_label.textContent = "Source URL: ";
				source_url_label.for = `${page_module.type}_${page_module.id}_source_url`;
				source_url_input.addEventListener("input", event => {
					if (source_url_input.value != "") {
						page_module.url = source_url_input.value;
						this.updatePageModule(page_module);
					}
				});
				// new_row.appendChild(document.createElement("br"));
				new_row.appendChild(source_url_label);
				new_row.appendChild(source_url_input);
			}

			page_module.popup_window_entry = new_row;
			modules_fieldset.appendChild(new_row);
			// return new_row;
		}

		modules_fieldset.appendChild(document.createElement("br"));
		let new_module_select = document.createElement("div");
		new_module_select.appendChild(document.createTextNode("New module: "));

		["Text", "Page number", "Image"].forEach(module_type => {
			let temp_button = document.createElement("button");
			temp_button.textContent = module_type;
			temp_button.onclick = (event) => {
				this.createPageModule({
					"type": module_type.toLowerCase().replace(' ', '_'),
					"location": header_or_footer
				});
				this.openEditWindow(header_or_footer, focused_page);
			}
			new_module_select.appendChild(temp_button);
		});
		modules_fieldset.appendChild(new_module_select);

		this.popup_window.content.appendChild(settings_fieldset);
		this.popup_window.content.appendChild(modules_fieldset);
	}

	closeEditWindow() {
		this.popup_window.content.innerHTML = "";
		this.popup_window.element.style["display"] = "none";
		this.click_off_popup_event_listener = "off";
		this.styles[this.popup_window.currently_editing].sheet.rules[0].style["border"] = "none";
		this.popup_window.currently_editing = "none";
	}
}

class Page {
	constructor(pages_container, element = "new", page_number = -1) {
		var element, header, main, content, footer;
		if (page_number == -1) {
			this.page_number = pages_container.pages.length;
			// console.log(pages_container.pages);
		}
		if (element === "new") {
			this.element = document.createElement("div");
			this.header = document.createElement("div");
			this.main = document.createElement("div");
			this.content = document.createElement("div");
			this.footer = document.createElement("div");

			this.element.classList.add("page");
			this.header.classList.add("header");
			this.main.classList.add("main");
			this.content.classList.add("content");
			this.content.setAttribute("contenteditable", "true");
			this.footer.classList.add("footer");

			this.element.appendChild(this.header);
			this.element.appendChild(this.main);
			this.main.appendChild(this.content);
			this.element.appendChild(this.footer);
		}
		else {
			this.element = element;
			this.header = this.element.querySelector(".header");
			this.main = this.element.querySelector(".main");
			this.content = this.element.querySelector(".content");
			this.footer = this.element.querySelector(".footer");
		}

		this.pages_container = pages_container;
		pages_container.pages.push(this);
		pages_container.page_container_element.appendChild(this.element);
		this.old_content_height = this.content.getBoundingClientRect().height;
		this.content_before_resize = this.content;

		let new_page_event = new CustomEvent("onnewpage", {
			"detail": this
		});
		document.dispatchEvent(new_page_event);

		let content_focus_event = new CustomEvent("onpagecontentfocus", {
			"detail": this
		});
		this.content.onfocus = () => {
			if (pages_container.currently_focused_content !== this.content) {
				pages_container.currently_focused_content = this.content;
				console.log(document.activeElement);
				document.dispatchEvent(content_focus_event);
			}
		}

		this.main.onclick = () => {
			this.content.focus();
		}

		this.header.onclick = (event) => {
			event.stopPropagation();
			pages_container.page_container_element.scrollTo(0, this.element.offsetTop - pages_container.page_container_element.offsetTop);
			pages_container.openEditWindow("header", this);

		}

		this.footer.onclick = (event) => {
			event.stopPropagation();
			pages_container.page_container_element.scrollTo(0, this.element.offsetTop + this.element.clientHeight - (pages_container.frame_element.clientHeight + pages_container.page_container_element.offsetTop));
			pages_container.openEditWindow("footer", this);
		}

		this.resize_observer = new ResizeObserver(() => {
			// console.log("carrot: " + getCaretCharacterOffsetWithin(this.content));
			// console.log("THing resized");
			if (this.checkIfContentOverflow(this.content)){
				let selection = getSelection();
				// console.log(selection);
				let selection_focus_node, selection_focus_offset;
				if (selection && selection.focusNode) {
					selection_focus_node = selection.focusNode;
					selection_focus_offset = selection.focusOffset;

					// while (selection_focus_node.childNodes[0] && selection_focus_node.nodeType !== Node.TEXT_NODE) {
					// 	selection_focus_node = selection_focus_node.childNodes[0];
					// }
					// if (selection_focus_node && selection_focus_node.nodeType === Node.TEXT_NODE) {
						// console.log(selection_focus_node.parentNode);
						// console.log(selection_focus_node);
						// console.log(selection_focus_offset);
					// }
				}
				// else {
				// 	console.log("No selection or focusNode is null");
				// }
				// if (this.children.length == 1)
				let overflows = this.findOverflows(this.content, {
					"selection": selection,
					"focus_node": selection_focus_node,
					"focus_offset": selection_focus_offset
				});
				// console.log(overflows);
				if (this.content.children.length == 0) {
					// UNDO();
					// this.content.appendChild(overflows[0]);
					// this.content.replaceWith(this.content_before_resize);
					this.content.innerHTML = this.content_html_before_resize;
					alert("Couldn't edit content: element overflows page.");
					document.activeElement.blur();
				}
				else if (overflows.length > 0) {
					if (this.page_number+1 >= pages_container.pages.length) {
						new Page(pages_container, "new");
					}
					// let caret_parent_nodes = [...caret_parent.childNodes];
					let elements_to_move = Pages.listToFragment(overflows);
					pages_container.pages[this.page_number+1].content.prepend(elements_to_move);
					pages_container.pages[this.page_number+1].combineElements();

					if (pages_container.new_caret_node) {
						Pages.setCaretPosition(selection, pages_container.new_caret_node, pages_container.new_caret_offset);
						pages_container.pages[this.page_number+1].content.focus();
						pages_container.page_container_element.scrollTo(0, pages_container.pages[this.page_number+1].element.offsetTop);
						// console.log("New caret");
						pages_container.new_caret_node = undefined;
						pages_container.new_caret_offset = undefined;
					}
					else if (selection_focus_node) {
						// console.log("there is selection_focus_node");
						Pages.setCaretPosition(selection, selection_focus_node, selection_focus_offset);
						if (pages_container.pages[this.page_number+1].content.contains(selection_focus_node)) {
							pages_container.page_container_element.scrollTo(0, pages_container.pages[this.page_number+1].element.offsetTop);
						}
					}

					// if (pages_container.pages[this.page_number+1].content.contains(selection_focus_node)) {
					// 	console.log("Next page has that seleciton node bro");
					// 	pages_container.pages[this.page_number+1].content.focus();
					// }
				}
			}
			else if (this.content.getBoundingClientRect().height < this.old_content_height && this.page_number < pages_container.pages.length-1 && pages_container.pages[this.page_number+1].content.children.length > 0) {
				let available_space = this.main.clientHeight - this.content.clientHeight;
				// console.log("Reduced size. Available space: " + available_space);
				let margin_penalty = Pages.pixelsToNumber(window.getComputedStyle(this.content.lastElementChild).marginBottom);
				let margin_two = Pages.pixelsToNumber(window.getComputedStyle(pages_container.pages[this.page_number+1].content.firstElementChild).marginTop);
				if (margin_two > margin_penalty) {
					margin_penalty = margin_two;
				}

				// console.log(margin_penalty);
				available_space -= margin_penalty;

				this.content.append(Pages.listToFragment(pages_container.pages[this.page_number+1].findUnderflows(available_space)));
				this.combineElements();
				pages_container.pages[this.page_number+1].deleteIfEmpty();
			}

			this.old_content_height = this.content.getBoundingClientRect().height;
			// this.content_before_resize = this.content.cloneNode(true);
			this.content_html_before_resize = this.content.innerHTML;
		}).observe(this.content);
		this.content.addEventListener("keydown", event => {
			if (event.key == "Backspace" && this.page_number > 0) {
				let selection = getSelection();
				// console.log(selection);
				let selection_focus_node, selection_focus_offset;
				if (selection && selection.focusNode) {
					selection_focus_node = selection.focusNode;
					selection_focus_offset = selection.focusOffset;

					while (selection_focus_node.childNodes[0] && selection_focus_node.nodeType !== Node.TEXT_NODE) {
						selection_focus_node = selection_focus_node.childNodes[0];
					}
				}
				else {
					console.log("No selection or focusNode is null");
				}
				let previous_page_last_node = pages_container.pages[this.page_number-1].content;
				let new_caret_index = 0;
				while (previous_page_last_node.lastChild) {
					previous_page_last_node = previous_page_last_node.lastChild;
				}
				new_caret_index = previous_page_last_node.textContent.length;
				// console.log(this.content.children[0]);
				// console.log(selection_focus_node);
				// console.log(selection_focus_offset);
				if ((this.content.children[0] == selection_focus_node || this.content.children[0] == selection_focus_node.parentElement) && selection_focus_offset == 0 && this.page_number > 0) {
					// console.log("Move cursor to end of previous page");
					pages_container.pages[this.page_number-1].content.focus();
					Pages.setCaretPosition(selection, previous_page_last_node, new_caret_index);
					pages_container.pages[pages_container.pages.length-1].deleteIfEmpty();
				}
			}
		});
		// for (let page of pages_container) {
			for (let page_module of pages_container.page_modules) {
				pages_container.updatePageModule(page_module);
			}
		// }
	}

	// Starting from the top, get as many elements that can fit into ...
	// ... available_space, measured as pixels on the Y axis.
	// Used for moving elements up when the user deletes something.
	// If there are bugs, change this to be more like findOverflows
	// ie. move elements up until previous page checkIfContentOverflow(content) is triggered.
	findUnderflows(available_space, master = this.content) {
		let underflown_elements = [];
		for (let child of master.children) {
			let rect = child.getBoundingClientRect()
			if (rect.top + rect.height <= available_space + this.content.getBoundingClientRect().top) {
				underflown_elements.push(child);
			}
			else if (Pages.spitting_tags.indexOf(child.tagName.toLowerCase()) > -1) {
				// console.log(child.tagName);
				let underflown_children = this.findUnderflows(available_space, child);

				let id;

				if (!child.classList.contains("combine")) {
					id = 0;
					while (this.pages_container.page_container_element.querySelectorAll(`${child.tagName}.combineid-${id}`).length > 0) {
						id++;
					}
				}
				else {
					// console.log(Array.from(child.classList));
					id = Array.from(child.classList).filter(c => c.substring(0, 10) == "combineid-")[0].substring(10);
				}

				if (underflown_children.length == child.children.length) {
					underflown_elements.pop();
				}
				else if (underflown_children.length == 0) {
					break;
				}
				let temp_element = child.cloneNode(false);
				for (let child_element of underflown_children) {
					temp_element.appendChild(child_element);
				}
				child.classList.add("combine",`combineid-${id}`);
				temp_element.classList.add("combine",`combineid-${id}`);
				// console.log(temp_element);
				underflown_elements.push(temp_element);
			}
			else {
				// console.log(child.tagName);
				break;
			}
		}
		return underflown_elements;
	}

	// Used to move content to the next page when this page is overflowing.
	findOverflows(master, caret_selection = undefined) {
		// these will be moved from the end of page 1
		// to the top of page 2
		let overflowing_elements = [];
		let i = master.children.length;
		while (this.checkIfContentOverflow(this.content) && i > 0) {
			let child = master.children[--i];
			// console.log(child);
			// overflowing_elements.push(child);
			master.removeChild(child); // child remains in memory
			// console.log(child);
			if (!this.checkIfContentOverflow(this.content)) {
				// console.log("yo");
				if (["tr", "li"].indexOf(child.tagName.toLowerCase()) == -1 && child.children.length > 0) {
					master.appendChild(child);
					let overflown_children = this.findOverflows(child, caret_selection);
					// console.log(overflown_children);

					// console.log(child.children);
					let id;

					if (!child.classList.contains("combine")) {
						id = 0;
						while (this.pages_container.page_container_element.querySelectorAll(`${child.tagName}.combineid-${id}`).length > 0) {
							id++;
						}
					}
					else {
						// console.log(Array.from(child.classList));
						id = Array.from(child.classList).filter(c => c.substring(0, 10) == "combineid-")[0].substring(10);
					}

					let temp_element = child.cloneNode(false);
					for (let child_element of overflown_children) {
						temp_element.appendChild(child_element);
					}
					if (child == caret_selection.focus_node) {
						// console.log("Hey child is focus node");
						// console.log(caret_selection);
						// console.log(child.innerText);
						if (caret_selection.focus_offset >= child.innerText.length) {
							// console.log("greater dan");
							// temp_element.innerText += "wrw";
							// Pages.setCaretPosition(caret_selection.selection, temp_element, caret_selection.focus_offset);
							// this.pages_container.pages[this.page_number+1].content.focus();
							this.pages_container.new_caret_node = temp_element;
							this.pages_container.new_caret_offset = caret_selection.focus_offset - child.innerText.length;
						}
						// else {
						// 	console.log("less dan");
						// }
					}
					if (child.children.length == 0) {
						// console.log("remooving");
						master.removeChild(child);
					}
					else {
						child.classList.add("combine",`combineid-${id}`);
						// master.appendChild(child);
					}
					temp_element.classList.add("combine",`combineid-${id}`);
					overflowing_elements.splice(0, 0, temp_element);
					// overflowing_elements.push(temp_element);
				}
				else {
					overflowing_elements.splice(0, 0, child);
				}

			}
			else {
				overflowing_elements.splice(0, 0, child);
				// overflowing_elements.push(child);
			}
			// if (caret_selection && child == caret_selection.focus_node) {
			// 	Pages.setCaretPosition(caret_selection.selection, caret_selection.focus_node, caret_selection.focus_offset);
			// }
		}
		return overflowing_elements
	}

	combineElements(direction = "down") {
		let children = this.content.children;
		if (direction == "up") {
			children.reverse();
		}
		let e = 0;
		for (let e = 0; e < children.length - 1; e++) {
			if (children[e].classList.contains("combine")) {
				let i = e + 1;
				while (i < children.length && (children[i].classList.contains("combine") && children[e].tagName == children[i].tagName) && Array.from(children[e].classList).filter(c => c.substring(0, 10) == "combineid-")[0].substring(10) == Array.from(children[i].classList).filter(c => c.substring(0, 10) == "combineid-")[0].substring(10)) {
					children[e].replaceChildren(...children[e].children, ...children[i].children);
					this.content.removeChild(children[i]);
				}
			}
		}
		// Clean up unneeded combine classes
		for (let i = 1; i < children.length - 1; i++) {
			let previous_child_combineid_class = Array.from(children[i-1].classList).filter(c => c.substring(0, 10) == "combineid-")[0];
			let this_child_combineid_class = Array.from(children[i].classList).filter(c => c.substring(0, 10) == "combineid-")[0];
			let next_child_combineid_class = Array.from(children[i+1].classList).filter(c => c.substring(0, 10) == "combineid-")[0];
			if ((previous_child_combineid_class != this_child_combineid_class || children[i-1].tagName != children[i].tagName) &&
				this_child_combineid_class != next_child_combineid_class || children[i].tagName != children[i+1].tagName) {
				// console.log("it werks");
				children[i].classList.remove(this_child_combineid_class);
				children[i].classList.remove("combine");
			}
		}
	}

	deleteIfEmpty() {
		if (["", "\n"].indexOf(this.content.innerText) > -1) {
			this.pages_container.pages[this.page_number-1].deleteIfEmpty();
			this.delete();
		}
	}

	delete() {
		let delete_event = new CustomEvent("ondeletepage", {
			"detail": this
		});
		document.dispatchEvent(delete_event);
		this.pages_container.page_container_element.removeChild(this.pages_container.pages[this.page_number].element);
		if (this.page_number < this.pages_container.pages.length-1) {
			for (let i = this.page_number+1; i < this.pages_container.pages.length; i++) {
				this.pages_container.pages[i].page_number = i-1;
			}
		}
		this.pages_container.pages.splice(this.page_number, 1);
	}

	checkIfContentOverflow(element) {
		let element_rect = element.getBoundingClientRect();
		let page_rect = this.element.getBoundingClientRect();
		let page_footer_rect = this.footer.getBoundingClientRect();

		if (element_rect.height + element_rect.top > (page_rect.top + page_rect.height) - page_footer_rect.height) {
			return true;
		}
		else {
			return false;
		}
	}
}

export default Pages;
