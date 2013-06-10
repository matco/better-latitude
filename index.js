'use strict';

var api_key = 'AIzaSyCtRFkNDl7AbRy2FvgLQNEWtv6kCctfwR0';
var client_id = '724606168264.apps.googleusercontent.com';
var scopes = 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/latitude.all.best https://www.googleapis.com/auth/latitude.all.city https://www.googleapis.com/auth/latitude.current.best https://www.googleapis.com/auth/latitude.current.best';

var current_date;
var all_records = {};

var map;
var trip;

var Ns = {
	SVG : 'http://www.w3.org/2000/svg',
	XHTML : 'http://www.w3.org/1999/xhtml',
	XLINK : 'http://www.w3.org/1999/xlink'
};

window.addEventListener(
	'load',
	function() {

		var UI = (function() {
			var loading = document.getElementById('loading');
			var timeout;
			function message(container, content, time) {
				if(timeout) {
					clearTimeout(timeout);
				}
				container.clear();
				if(content instanceof Node) {
					container.appendChild(content);
				}
				else {
					container.textContent = content;
				}
				timeout = setTimeout(function() {
					container.clear();
				}, time || 5000);
			}
			return {
				startLoading : function() {
					loading.style.display = 'block';
				},
				stopLoading : function() {
					loading.style.display = 'none';
				},
				info : function(content, time) {
					message(document.getElementById('info'), content, time);
				},
				error : function(content, time) {
					message(document.getElementById('error'), content, time);
				}
			};
		})();

		//authentication
		function auth(immediate, callback) {
			var config = {
				client_id : client_id,
				scope : scopes,
				immediate : immediate
			};
			window.setTimeout(function() {
				gapi.auth.authorize(config, callback);
			}, 1);
		}

		//set api key
		gapi.client.setApiKey(api_key);

		//manage authentication
		auth(true, logged_in);

		document.getElementById('authorize').addEventListener(
			'click',
			function(event) {
				auth(false, logged_in);
			}
		);

		function logged_in(token) {
			if(token) {
				console.log('Access granted');
				//manage ui
				UI.stopLoading();
				document.getElementById('authorization').style.display = 'none';
				document.querySelector('header').style.display = 'block';
				//load latitude api
				gapi.client.load('latitude', 'v1', function() {
					//console.log(gapi.client.latitude);
					var request = gapi.client.latitude.currentLocation.get({granularity : 'best'});
					request.execute(function(response) {
						var latlng = new google.maps.LatLng(response.latitude, response.longitude);
						//calculate zoom based on current location accuracy
						var zoom = Math.round(-50 * response.accuracy / 10000 + 16)  || 8;
						//create map centered on last known position
						map = new google.maps.Map(document.getElementById('map'), {
							center : latlng,
							zoom : zoom,
							mapTypeId : google.maps.MapTypeId.ROADMAP
						});
						//create marker on last known position
						new google.maps.Marker({
							map : map,
							position : latlng,
							icon : 'https://maps.google.com/mapfiles/ms/micons/blue.png',
							title : 'Last known position'
						});
						info.open(map);
						//manage map resize
						window.addEventListener(
							'resize',
							function() {
								google.maps.event.trigger(map, 'resize');
							}
						);
						show_current_locations();
					});
				});
			}
			else {
				document.getElementById('authorization').style.display = 'block';
			}
		}

		//manage geolocalize
		document.getElementById('geolocalize').addEventListener(
			'click',
			function() {
				var geolocalize = this;
				geolocalize.setAttribute('disabled', 'disabled');
				document.getElementById('message').textContent = 'Geolocalizing...';
				navigator.geolocation.getCurrentPosition(function(position) {
					document.getElementById('message').textContent = '';
					map.setCenter(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
					geolocalize.removeAttribute('disabled');
				});
			}
		);

		//manage pan
		document.getElementById('pan').addEventListener(
			'click',
			function() {
				if(trip) {
					map.fitBounds(trip.getLimits());
				}
			}
		);

		//retrieve stored state and data in local storage
		current_date = localStorage.getItem('latitude.current_date') ? new Date(parseInt(localStorage.getItem('latitude.current_date'))) : new Date();
		all_records = localStorage.getItem('latitude.all_records') ? localStorage.getObject('latitude.all_records') : {};
		document.getElementById('details').style.display = localStorage.getItem('latitude.display_details') === 'true' ? 'block' : 'none';

		//manage controls
		function update_current_date() {
			document.getElementById('date_picker')['date'].value = current_date.toDisplay();
			document.getElementById('current_date').textContent = current_date.getDayName('en') + ', ' + current_date.getDate() + ' ' + current_date.getMonthName() + ' ' + current_date.getFullYear();
			if(Date.getDifferenceInDays(current_date, new Date()) < 0) {
				document.getElementById('next_day').setAttribute('disabled', 'disabled');
			}
			else {
				document.getElementById('next_day').removeAttribute('disabled');
			}
		}
		update_current_date();

		function show_current_locations() {
			var start = new Date(current_date);
			start.setHours(0, 0, 0, 0);
			var stop = new Date(current_date);
			stop.setHours(24, 0, 0, 0);
			retrieve_records(start, stop, show_records);
		}

		function hide_date_picker() {
			document.getElementById('date').style.display = 'none';
			document.getElementById('current_date').classList.remove('unfolded');
		}

		document.getElementById('current_date').addEventListener(
			'click',
			function() {
				var date = document.getElementById('date');
				if(this.classList.contains('unfolded')) {
					hide_date_picker();
				}
				else {
					this.classList.add('unfolded');
					date.style.display = 'block';
				}
			}
		);

		document.getElementById('date_picker').addEventListener(
			'submit',
			function(event) {
				event.preventDefault();
				current_date = Date.parseToDisplay(this['date'].value);
				update_current_date();
				show_current_locations();
				hide_date_picker();
			}
		);

		document.getElementById('today').addEventListener(
			'click',
			function() {
				hide_date_picker();
				current_date = new Date();
				update_current_date();
				show_current_locations();
			}
		);

		document.getElementById('previous_day').addEventListener(
			'click',
			function() {
				current_date.addDays(-1);
				update_current_date();
				show_current_locations();
			}
		);

		document.getElementById('next_day').addEventListener(
			'click',
			function() {
				current_date.addDays(1);
				update_current_date();
				show_current_locations();
			}
		);

		function retrieve_records(start, stop, callback) {
			//build request parameters
			var parameters = {granularity : 'best', 'max-results' : 1000};
			if(start && stop) {
				parameters['min-time'] = start.getTime();
				parameters['max-time'] = stop.getTime();
			}
			var request = gapi.client.latitude.location.list(parameters);
			request.execute(function(response) {
				if(response.error) {
					//logged out
					if(response.error.code === 401) {
						UI.error(document.createElement('a', {href : window.location.href}, 'You\'ve been logged out. Please reload the page'));
					}
					else {
						UI.info('Error:  ' + response.error.message);
					}
				}
				else if(callback) {
					//records are delivered from newsest to oldest
					var items = response.items || [];
					items.reverse();
					callback.call(null, items);
				}
			});
		}

		function generate_stats(stats) {
			var table = document.getElementById('template_stats_figures').cloneNode(true);
			table.querySelector('[data-content="total_distance"]').textContent = format_distance(stats.total_distance);
			table.querySelector('[data-content="max_distance"]').textContent = format_distance(stats.max_distance);
			table.querySelector('[data-content="max_speed"]').textContent = format_speed(stats.max_speed);
			table.querySelector('[data-content="total_distance_stationary"]').textContent = format_time(stats.travel_forms['STATIONARY']);
			table.querySelector('[data-content="total_distance_walking"]').textContent = format_time(stats.travel_forms['WALKING']);
			table.querySelector('[data-content="total_distance_motorized"]').textContent = format_time(stats.travel_forms['MOTORIZED']);
			return table;
		}

		function show_records(records) {
			//remove previous trip of any
			if(trip) {
				trip.locations.forEach(function(location) {
					location.marker.setMap(null);
				});
				trip.getPolyline().setMap(null);
			}
			trip = new Trip();

			//remove previous graph details
			var graph = document.getElementById('details_graph');
			graph.clear();

			//remove previous stats details
			document.getElementById('details_stats').clear();

			//remove previous selection if any
			hide_location_options();

			//show info
			if(records.isEmpty()) {
				UI.info('No records for this period');
				return;
			}
			if(records.length === 1000) {
				UI.info('Wow, you have more 1000 records stored for this period. Only 1000 first records will be shown');
			}
			else {
				UI.info(records.length + ' records shown');
			}

			function location_click_listener() {
				show_location_options(this.location);
			}
			//manage all records
			records.forEach(function(record, index) {
				//save records
				//all_records[record.timestampMs] = {lat : record.latitude, lng : record.longitude};

				var location = new Location(new Date(parseInt(record.timestampMs)), record.latitude, record.longitude, record.accuracy);
				trip.addLocation(location);

				//add marker on map
				var marker = location.getMarker(index);
				marker.setMap(map);
				google.maps.event.addListener(marker, 'click', location_click_listener);
			});

			trip.getPolyline().setMap(map);
			//change map center and zoom to view on markers
			map.fitBounds(trip.getLimits());

			//update stats after ui has been updated
			setTimeout(function() {
				var stats = trip.getStats();
				//graph displays full days
				var total_time_days = Math.round(stats.total_time / 3600 / 24) || 1;
				//offset between beginning of the day and departure time of the trip
				var departure_offset = (trip.getDeparture().date.getTime() - new Date(trip.getDeparture().date).setHours(0, 0, 0, 0)) / 1000;

				var height = 80;
				var width = 600; //banner.style.offsetWidth - 100;
				var plot = document.createFullElementNS(Ns.SVG, 'g', {transform : 'translate(40.5, 10.5)'});
				graph.appendChild(plot);

				//find scales
				var meter_in_pixel = stats.max_distance > 0 ? height / stats.max_distance : 0;
				var second_in_pixel = width / (total_time_days * 3600 * 24);

				//x-axis
				plot.appendChild(document.createFullElementNS(Ns.SVG, 'line', {x1 : 0, y1 : height, x2 : width + 10, y2 : height, 'class' : 'axis'}));
				plot.appendChild(document.createFullElementNS(Ns.SVG, 'path', {d : 'M' + (width + 10) + ' ' + (height - 5) + ' L' + (width + 15) + ' ' + height + ' L' + (width + 10) + ' ' + (height + 5), 'class' : 'axis'}));
				//y-axis
				plot.appendChild(document.createFullElementNS(Ns.SVG, 'line', {x1 : 0, y1 : -10, x2 : 0, y2 : height, 'class' : 'axis'}));
				plot.appendChild(document.createFullElementNS(Ns.SVG, 'path', {d : 'M-5 -5 L0 -10 L5 -5', 'class' : 'axis'}));
				//graduations
				var i;
				//x-axis
				var graduation_x;
				for(i = 0; i <= 24; i+= 3) {
					graduation_x = Math.round(i * second_in_pixel * 60 * 60);
					if(i > 0) {
						plot.appendChild(document.createFullElementNS(Ns.SVG, 'line', {x1 : graduation_x, y1 : height, x2 : graduation_x, y2 : height + 5, 'class' : 'axis'}));
					}
					plot.appendChild(document.createFullElementNS(Ns.SVG, 'text', {x : graduation_x - (i > 10 ? 15 : 10), y : height + 15}, i + ':00'));
				}
				//y-axis
				var graduation_y, graduation_value;
				var divider, unit;
				if(stats.max_distance > 5000) {
					divider = 1000;
					unit = 'km';
				}
				else {
					divider = 1;
					unit = 'm';
				}
				for(i = 1; i <= 4; i++) {
					graduation_value = Math.round(stats.max_distance / (divider * 4)) * i;
					graduation_y = Math.round(graduation_value * divider * meter_in_pixel);
					plot.appendChild(document.createFullElementNS(Ns.SVG, 'line', {x1 : -5, y1 : height - graduation_y, x2 : 0, y2 : height - graduation_y, 'class' : 'axis'}));
					plot.appendChild(document.createFullElementNS(Ns.SVG, 'text', {x : -30, y : height - graduation_y + 3}, graduation_value + unit));
				}

				//draw dots
				var dots = document.createFullElementNS(Ns.SVG, 'g', {transform : 'translate(' + Math.round(departure_offset * second_in_pixel) + ', 0)'});
				plot.appendChild(dots);

				//tooltip
				var tooltip = document.createFullElementNS(Ns.SVG, 'g', {transform : 'translate(0)', 'class' : 'tooltip', style : 'display: none;'});
				var tooltip_rect = document.createFullElementNS(Ns.SVG, 'rect', {x : -28, y : (height + 5), width : 56, height : 15});
				var tooltip_text = document.createFullElementNS(Ns.SVG, 'text', {x : -21, y : height + 15}, '00:00:00');
				var tooltip_line = document.createFullElementNS(Ns.SVG, 'line', {x1 : 0, y1 : 0, x2 : 0, y2 : height + 15});
				tooltip.appendChild(tooltip_rect);
				tooltip.appendChild(tooltip_text);
				tooltip.appendChild(tooltip_line);
				dots.appendChild(tooltip);
				function location_mouseover() {
					this.setAttribute('r', 5);
					this.style.fill = '#FF532A';
					tooltip_text.textContent = this.location.date.format('${hours}:${minutes}:${seconds}');
					tooltip.setAttribute('transform', 'translate(' + Math.round(this.location.timeFromDeparture * second_in_pixel) + ')');
					tooltip.style.display = 'block';
				}
				function location_mouseout() {
					tooltip.style.display = 'none';
					this.style.fill = 'red';
					this.setAttribute('r', 2);
				}

				var previous_position = {
					x : 0,
					y : height
				};

				trip.locations.forEach(function(place, index) {
					var new_position = {
						x : place.timeFromDeparture * second_in_pixel,
						y : height - place.distanceFromDeparture * meter_in_pixel
					};
					place.dot = document.createFullElementNS(Ns.SVG, 'circle', {cx : new_position.x, cy : new_position.y, r : 2, 'class' : 'path', title : Math.round(place.distanceFromDeparture / 1000) + 'km'});
					place.dot.location = place;
					place.dot.addEventListener('click', location_click_listener);
					place.dot.addEventListener('mouseover', location_mouseover);
					place.dot.addEventListener('mouseout', location_mouseout);
					dots.appendChild(place.dot);
					if(index > 0) {
						place.line = document.createFullElementNS(Ns.SVG, 'line', {x1 : previous_position.x, y1 : previous_position.y, x2 : new_position.x, y2 : new_position.y, 'class' : 'path'});
						dots.appendChild(place.line);
						previous_position = new_position;
					}
				});

				//show stats
				document.getElementById('details_stats').appendChild(generate_stats(stats));
			}, 1);
		}

		function delete_position(location, callback) {
			var request = gapi.client.latitude.location.delete({locationId : location.date.getTime()});
			request.execute(function(response) {
				if(response.error) {
					if(callback) {
						callback.call(null, response.error);
					}
				}
				else {
					//find index in trip
					var index = trip.locations.indexOf(location);
					//delete from global records
					delete all_records[location.date.getTime()];
					//delete from graph
					location.dot.parentNode.removeChild(location.dot);
					//first marker does not have a line
					if(index > 0) {
						location.line.parentNode.removeChild(location.line);
					}
					//find next marker
					if(location.next) {
						var next_location = location.next;
						//delete next line too
						next_location.line.parentNode.removeChild(next_location.line);
						if(index > 0) {
							var previous_location = location.previous;
							//redraw new line
							next_location.line = document.createFullElementNS(Ns.SVG, 'line', {
								x1 : previous_location.dot.getAttribute('cx'),
								y1 : previous_location.dot.getAttribute('cy'),
								x2 : next_location.dot.getAttribute('cx'),
								y2 : next_location.dot.getAttribute('cy'),
								'class' : 'path'
							});
							next_location.dot.parentNode.appendChild(next_location.line);
						}
					}
					//delete from map
					location.marker.setMap(null);
					trip.getPolyline().getPath().removeAt(index);
					//remove from current records
					trip.removeLocation(location);
					if(callback) {
						callback.call(null);
					}
				}
			});
		}

		var accuracy = new google.maps.Circle({
			fillColor : '#2A4A70',
			fillOpacity : 0.5,
			strokeColor : '#2A4A70',
			strokeWeight : 2,
			clickable : false
		});

		var info = new InfoBox({
			content : document.getElementById('record_info'),
			visible : false,
			pixelOffset: new google.maps.Size(-140, 0),
			boxStyle: {
				background : 'url("https://google-maps-utility-library-v3.googlecode.com/svn/trunk/infobox/examples/tipbox.gif") no-repeat',
				opacity : 0.95,
				width : '320px'
			},
			closeBoxURL : '',
			infoBoxClearance : new google.maps.Size(1, 1)
		});

		function hide_location_options() {
			accuracy.setMap(null);
			info.setVisible(false);
			trip.locations.forEach(function(location) {
				location.dot.style.strokeColor = 'red';
				location.dot.style.fill = 'red';
			});
		}

		document.getElementById('record_info_close').addEventListener('click', hide_location_options);

		var previous_button = document.getElementById('record_info_previous');
		var next_button = document.getElementById('record_info_next');
		var delete_button = document.getElementById('record_info_delete');
		var delete_all_button = document.getElementById('record_info_delete_all');

		var previous_button_listener;
		var next_button_listener;
		var delete_button_listener;
		var delete_all_button_listener;

		function show_location_options(selected_location) {
			var same_locations = trip.locations.filter(Location.prototype.isSamePlace, selected_location);

			//show accuracy
			accuracy.setOptions({
				map : map,
				center : selected_location.getLatLng(),
				radius : selected_location.accuracy,
			});

			//move map if selected location is not displayed
			if(!map.getBounds().contains(selected_location.getLatLng())) {
				map.panTo(selected_location.getLatLng());
			}

			//highlight good dots
			trip.locations.forEach(function(location) {
				if(same_locations.contains(location)) {
					location.dot.style.strokeColor = '#151412';
					location.dot.style.fill = '#151412';
					//append dot at then end of its parent to control z-index
					location.dot.parentNode.appendChild(location.dot);
				}
				else {
					location.dot.style.strokeColor = 'red';
					location.dot.style.fill = 'red';
				}
			});

			function disable_buttons() {
				previous_button.setAttribute('disabled', 'disabled');
				next_button.setAttribute('disabled', 'disabled');
				delete_button.setAttribute('disabled', 'disabled');
				delete_all_button.setAttribute('disabled', 'disabled');
			}

			//enable buttons
			delete_button.removeAttribute('disabled');
			delete_all_button.removeAttribute('disabled');

			//hide navigation
			previous_button.style.display = 'none';
			next_button.style.display = 'none';

			//update info content
			document.getElementById('record_info_date').textContent = selected_location.date.toFullDisplay();
			document.getElementById('record_info_travel_form').textContent = get_travel_form(selected_location.speed).label;
			document.getElementById('record_info_travel_form').setAttribute('title', format_speed(selected_location.speed));
			document.getElementById('record_info_distance_from_departure').textContent = format_distance(selected_location.distanceFromDeparture) + ' from departure location';
			document.getElementById('record_info_time_from_departure').textContent = format_time(selected_location.timeFromDeparture) + ' after departure';

			//multiple
			var record_info_multiple = document.getElementById('record_info_multiple');
			if(same_locations.length > 1) {
				record_info_multiple.style.display = 'block';
				previous_button.style.display = 'block';
				next_button.style.display = 'block';

				//record number
				document.getElementById('record_info_number').textContent = same_locations.length;

				//previous
				if(previous_button_listener) {
					previous_button.removeEventListener('click', previous_button_listener);
				}
				previous_button_listener = function() {
					var index = same_locations.indexOf(selected_location);
					var previous_location = index === 0 ? same_locations.last() : same_locations[--index];
					show_location_options(previous_location);
				};
				previous_button.addEventListener('click', previous_button_listener);

				//next
				if(next_button_listener) {
					next_button.removeEventListener('click', next_button_listener);
				}
				next_button_listener = function() {
					var index = same_locations.indexOf(selected_location);
					var next_location = index === (same_locations.length - 1) ? same_locations.first() : same_locations[++index];
					show_location_options(next_location);
				};
				next_button.addEventListener('click', next_button_listener);
			}
			else {
				record_info_multiple.style.display = 'none';
			}

			//delete
			if(delete_button_listener) {
				delete_button.removeEventListener('click', delete_button_listener);
			}
			delete_button_listener = function() {
				disable_buttons();
				UI.startLoading();
				delete_position(selected_location, function(error) {
					if(error) {
						console.error(error);
						UI.info('Unable to delete record: ' + error.message + ' (code:' + error.code + ')');
					}
					else {
						hide_location_options();
						UI.stopLoading();
						UI.info('Record successfully deleted');
					}
				});
			};
			delete_button.addEventListener('click', delete_button_listener);

			//delete all
			delete_all_button.removeAttribute('disabled');
			if(delete_all_button_listener) {
				delete_all_button.removeEventListener('click', delete_all_button_listener);
			}
			if(same_locations.length > 1) {
				delete_all_button.style.display = 'inline';
				delete_all_button_listener = function() {
					disable_buttons();
					UI.startLoading();

					var success = 0;

					var queue = new Queue({
						parallel : 2,
						onEnd : function() {
							hide_location_options();
							UI.stopLoading();
							UI.info(success + ' records successfully deleted');
						}
					});

					var on_delete = function(error) {
						if(error) {
							queue.clear();
							queue.onEnd = function() {
								hide_location_options();
								UI.stopLoading();
								console.error(error);
								var message;
								if(success > 0) {
									message = 'No record have been deleted';
								}
								else {
									message = 'Only ' + success + ' records have been deleted';
								}
								UI.info(message + ': ' + error.message + ' (code:' + error.code + ')');
							};
						}
						else {
							success++;
							UI.info(success + '/' + same_locations.length + ' records deleted');
						}
					};

					same_locations.slice().forEach(function(location) {
						var task = new QueueTask(delete_position, undefined, [location]);
						task.onEnd = on_delete;
						queue.add(task);
					});
				};
				delete_all_button.addEventListener('click', delete_all_button_listener);
			}
			else {
				delete_all_button.style.display = 'none';
			}

			//place and show infobox
			info.setPosition(selected_location.getLatLng());
			info.setVisible(true);
		}

		document.getElementById('details_button').addEventListener(
			'click',
			function() {
				var details = document.getElementById('details');
				if(this.classList.contains('unfolded')) {
					this.classList.remove('unfolded');
					details.style.display = 'none';
				}
				else {
					this.classList.add('unfolded');
					details.style.display = 'block';
				}
			}
		);

		//add record
		(function() {
			document.getElementById('add_record_close').addEventListener(
				'click',
				function() {
					add_record_info.setVisible(false);
					add_marker.setVisible(false);
				}
			);

			var add_marker = new google.maps.Marker({
				icon : 'http://maps.google.com/mapfiles/ms/micons/green.png',
				title : 'Add record',
				draggable : true
			});
			var add_record_info = new InfoBox({
				content : document.getElementById('add_record_info'),
				pixelOffset: new google.maps.Size(-140, 0),
				boxStyle: {
					background : 'url("http://google-maps-utility-library-v3.googlecode.com/svn/trunk/infobox/examples/tipbox.gif") no-repeat',
					opacity : 0.95,
					width : '320px'
				},
				closeBoxURL : '',
				infoBoxClearance : new google.maps.Size(1, 1)
			});

			google.maps.event.addListener(
				add_marker,
				'click',
				function() {
					add_record_info.open(map, add_marker);
				}
			);
			/*google.maps.event.addListener(
				add_marker,
				'drag',
				function() {
					add_info.setPosition(this.getPosition());
				}
			);*/

			document.getElementById('add_record_info').addEventListener(
				'submit',
				function(event) {
					event.preventDefault();
					var time = Date.parseToFullDisplay(this['datetime'].value).getTime();
					var request = gapi.client.latitude.location.insert({
						'timestampMs' : time + '',
						'latitude' : add_marker.getPosition().lat(),
						'longitude' : add_marker.getPosition().lng()
					});
					request.execute(function(response) {
						if(response.error) {
							UI.info(response.error.message);
						}
						else {
							UI.info('Location successfully added');
						}
					});
				}
			);

			document.getElementById('add').addEventListener(
				'click',
				function(event) {
					document.getElementById('add_record_info')['datetime'].value = current_date.toFullDisplay();
					add_marker.setOptions({
						position : map.getCenter(),
						map : map
					});
					add_record_info.setOptions({
						map : map,
						position : map.getCenter()
					});
				}
			);
		})();

		function update_stored_records() {
			var record_dates = Object.keys(all_records);
			record_dates.sort();
			document.getElementById('local_records_number').textContent = record_dates.length;
			if(record_dates.length > 0) {
				document.getElementById('local_records_min_date').textContent = new Date(parseInt(record_dates.first())).toDisplay();
				document.getElementById('local_records_max_date').textContent = new Date(parseInt(record_dates.last())).toDisplay();
				document.getElementById('local_records_info').style.display = 'inline';
			}
			else {
				document.getElementById('local_records_info').style.display = 'none';
			}
		}

		(function() {
			function get_records() {
				retrieve_records(very_old_date, oldest_date, function(records) {
					//store fetched records
					var oldest_record;
					records.forEach(function(record, index) {
						var timestamp = parseInt(record.timestampMs);
						if(!oldest_record || timestamp < oldest_record) {
							oldest_record = timestamp;
						}
						all_records[record.timestampMs] = {lat : record.latitude, lng : record.longitude, acc : record.accuracy};
					});
					//count items
					update_stored_records();
					//continue while there is items
					if(records.length === 1000 && fecthing_records) {
						oldest_date.setTime(oldest_record);
						get_records();
					}
				});
			}

			var fecthing_records = false;

			//prepare dates
			var very_old_date = new Date();
			very_old_date.setFullYear(1900, 1, 1);
			//current date
			var oldest_date = new Date();

			document.getElementById('stats_fetch_records').addEventListener(
				'click',
				function() {
					if(!fecthing_records) {
						fecthing_records = true;
						document.getElementById('stats_fetching_records').style.display = 'inline';
						this.textContent = 'Stop fetching records';
						var records_number = 0;
						get_records();
					}
					else {
						fecthing_records = false;
						document.getElementById('stats_fetching_records').style.display = 'none';
						this.textContent = 'Fetch records';
					}
				}
			);
		})();


		function clear_records() {
			all_records = {};
			update_stored_records();
		}

		document.getElementById('stats_clear_all_records').addEventListener('click', clear_records);
		document.getElementById('stats_close').addEventListener('click', function() {
			document.getElementById('stats').style.display = 'none';
		});

		//stats
		(function() {
			var heatmap = new google.maps.visualization.HeatmapLayer();
			var shown = false;
			document.getElementById('stats_button').addEventListener(
				'click',
				function() {
					update_stored_records();
					document.getElementById('stats').style.display = 'block';
				}
			);
			document.getElementById('heatmap_go').addEventListener(
				'click',
				function() {
					if(shown) {
						heatmap.setMap(null);
					}
					else {
						var data = [];
						var locations = Object.values(all_records);
						if(locations.length > 1) {
							//sort records on location
							locations.sort(function(location_1, location_2) {
								if(location_1.lat !== location_2.lat) {
									return location_1.lat - location_2.lat;
								}
								return location_1.lng - location_2.lng;
							});
							//reduce records by setting a weight on each location
							var last_location;
							locations.forEach(function(location) {
								if(data.isEmpty() || last_location.lat !== location.lat && last_location.lng !== location.lng) {
									data.push({location : new google.maps.LatLng(location.lat, location.lng), weight : 0});
									last_location = location;
								}
								else {
									data.last().weight++;
								}
							});
							UI.info(data.length + ' locations used to create the heatmap (reduced from ' + locations.length + ' records)');
							heatmap.setOptions({
								map : map,
								data : data
							});
						}
						else {
							UI.info('Not enough data to display heatmap');
						}
					}
					shown = !shown;
				}
			);
			document.getElementById('stats_go').addEventListener(
				'click',
				function() {
					var all_trip = new Trip();
					var timestamp, record;
					for(timestamp in all_records) {
						record = all_records[timestamp];
						all_trip.addLocation(new Location(new Date(parseInt(timestamp)), record.lat, record.lng, record.acc));
					}
					var stats = all_trip.getStats();
					document.getElementById('stats_figures').clear();
					document.getElementById('stats_figures').appendChild(generate_stats(stats));
				}
			);
		})();

		//about
		document.getElementById('about_button').addEventListener('click', function() {
			document.getElementById('about').style.display = 'block';
		});
		document.getElementById('about_close').addEventListener('click', function() {
			document.getElementById('about').style.display = 'none';
		});
	}
);

window.addEventListener(
	'unload',
	function() {
		localStorage.setItem('latitude.display_details', document.getElementById('details').style.display === 'block');
		localStorage.setItem('latitude.current_date', current_date.getTime());
		localStorage.setObject('latitude.all_records', JSON.stringify(all_records));
	}
);
