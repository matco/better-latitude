var TRAVEL_FORMS = [
	{
		id : 'STATIONARY',
		//lower than 3.6km/h
		speed_limit : 1,
		label : 'Stationary'
	},
	{
		id : 'WALKING',
		//lower than 9km/h
		speed_limit : 2.5,
		label : 'Walking'
	},
	{
		id : 'MOTORIZED',
		label : 'Motorized'
	}
];

function get_travel_form(speed) {
	var i = 0, length = TRAVEL_FORMS.length, form;
	for(; i < length; i++) {
		form = TRAVEL_FORMS[i];
		if(form.speed_limit && speed < form.speed_limit) {
			return form;
		}
	}
	return form;
}

//format time in seconds
function format_time(time) {
	var minutes = time % 60;
	var hours = Math.round(time / 3600) % 24;
	var days = Math.floor(time / (3600 * 24));
	var result = '';
	if(days) {
		result += (days + 'days ');
		hours = hours.pad(2);
	}
	if(hours) {
		result += (hours + 'h ');
		minutes = minutes.pad(2);
	}
	return result + (minutes + 'm');
}

//format speed in meters per second
function format_speed(speed) {
	return (Math.round(speed * 36) / 10) + 'km/h';
}

//format a distance in meters
function format_distance(distance) {
	if(distance < 500) {
		return Math.round(distance) + 'm';
	}
	return (Math.round(distance / 100) / 10) + 'km';
}

function Trip() {
	//all locations sorted from oldest to newest
	this.locations = [];
}

//departure of the trip
Trip.prototype.getDeparture = function() {
	return this.locations.first();
};

Trip.prototype.clearCache = function() {
	this.polyline = undefined;
	this.limits = undefined;
};

//all locations must be added in chronological order
Trip.prototype.addLocation = function(location) {
	//link location to trip
	location.trip = this;
	//find place were location should be added
	var length = this.locations.length;
	var index;
	//first location of the trip
	if(length === 0) {
		this.locations.push(location);
		index = 0;
	}
	else {
		//loop on all locations to find good place
		//TODO improve this, this is a sorted set!
		for(var i = 0; i < length - 1; i++) {
			if(location.date > this.locations[i].date && location.date < this.locations[i + 1].date) {
				//link location to others
				this.locations[i].next = location;
				location.previous = this.locations[i];
				this.locations[i + 1].previous = location;
				location.next = this.locations[i + 1];
				this.locations.insert(i + 1, location);
				index = i + 1;
				break;
			}
		}
		//location has the most recent date
		if(!index) {
			//link location to others
			location.previous = this.locations[length - 1];
			this.locations[length - 1].next = location;
			this.locations.push(location);
			index = length;
		}
	}
	//do some calculations for following locations
	if(location.previous) {
		//calculate distance and time from previous location
		location.timeFromPreviousLocation = Math.round((location.date.getTime() - location.previous.date.getTime()) / 1000);
		location.distanceFromPreviousLocation = location.getDistanceTo(location.previous);
		//calculate speed, considering that speed is null if distance from previous location is shorter than accuracy
		if(location.distanceFromPreviousLocation < location.accuracy) {
			location.speed = 0;
		}
		else {
			location.speed = location.distanceFromPreviousLocation / location.timeFromPreviousLocation;
		}
		//calculate distance and time from departure
		var departure = this.getDeparture();
		location.timeFromDeparture = Math.round((location.date.getTime() - departure.date.getTime()) / 1000);
		location.distanceFromDeparture = location.getDistanceTo(departure);
	}
	else {
		location.speed = 0;
		location.timeFromDeparture = 0;
		location.distanceFromDeparture = 0;
	}
};

Trip.prototype.removeLocation = function(location) {
	if(location.previous) {
		location.previous.next = location.next;
	}
	if(location.next) {
		location.next.previous = location.previous;
	}
	this.locations.removeElement(location);
	//location.delete();
};

Trip.prototype.getStats = function() {
	//highest speed
	var max_speed = 0;
	//farthest location
	var max_distance = 0;
	//total distance
	var total_distance = 0;
	//travel forms
	var travel_forms = {};
	TRAVEL_FORMS.forEach(function(form) {
		travel_forms[form.id] = 0;
	});

	var location = this.getDeparture();
	while(location = location.next) {
		//max speed
		if(location.speed > max_speed) {
			max_speed = location.speed;
		}
		//max distance
		if(location.distanceFromDeparture > max_distance) {
			max_distance = location.distanceFromDeparture;
		}
		total_distance += location.distanceFromPreviousLocation;
		//retrieve travel form
		var travel_form = get_travel_form(location.speed).id;
		travel_forms[travel_form] += location.timeFromPreviousLocation;
	}

	return {
		max_speed : max_speed,
		max_distance : max_distance,
		total_time : (this.locations.last().date.getTime() - this.locations.first().date.getTime()) / 1000,
		total_distance : total_distance,
		travel_forms : travel_forms
	};
};

Trip.prototype.getPolyline = function() {
	if(!this.polyline) {
		this.polyline = new google.maps.Polyline({
			strokeColor : '#FF0000',
			strokeOpacity : 0.8,
			strokeWeight : 2,
			path : this.locations.map(function(location) {return location.getLatLng();})
		});
	}
	return this.polyline;
};

Trip.prototype.getLimits = function() {
	if(!this.limits) {
		var limits = new google.maps.LatLngBounds();
		this.locations.forEach(function(location) {
			limits.extend(location.getLatLng());
		});
		this.limits = limits;
	}
	return this.limits;
};

function Location(date, latitude, longitude, accuracy) {
	//reference to trip
	this.trip;
	//date of the location
	this.date = date;
	//latitude and longitude of the location
	this.latitude = latitude;
	this.longitude = longitude;
	//accuracy of the location
	this.accuracy = accuracy;
	//previous location in time
	this.previous;
	//next location in time
	this.next;
	//distance from departure in meters
	this.distanceFromDeparture;
	//time from departure in seconds
	this.timeFromDeparture;
	//distance from previous location in meters
	this.distanceFromPreviousLocation;
	//time from previous location in seconds
	this.timeFromPreviousLocation;
	//current speed, calculated with time and distance from previous location in meters/seconds
	this.speed;
	//ui
	this.latlng;
	this.marker;
	this.dot;
	this.line;
}

(function() {
	function deg_to_rad(deg) {
		return deg * (Math.PI / 180);
	}

	function get_distance(location1, location2) {
		var R = 6371000;
		var delta_lat = deg_to_rad(location2.latitude - location1.latitude);
		var delta_lng = deg_to_rad(location2.longitude - location1.longitude);
		var lat1 = deg_to_rad(location1.latitude);
		var lat2 = deg_to_rad(location2.latitude);

		var a = Math.sin(delta_lat / 2) * Math.sin(delta_lat / 2) + Math.sin(delta_lng / 2) * Math.sin(delta_lng / 2) * Math.cos(lat1) * Math.cos(lat2); 
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	Location.prototype.getDistanceTo = function(location) {
		return get_distance(this, location);
	};
})();

Location.prototype.isSamePlace = function(location) {
	return this.latitude === location.latitude && this.longitude === location.longitude;
};

//ui
Location.prototype.getLatLng = function() {
	if(!this.latlng) {
		this.latlng = new google.maps.LatLng(this.latitude, this.longitude);
	}
	return this.latlng;
};

Location.prototype.getMarker = function(index) {
	if(!this.marker) {
		this.marker = new google.maps.Marker({
			position : this.getLatLng(),
			title : this.date.toFullDisplay(),
			zIndex : index || 0,
			flat : true
		});
		this.marker.location = this;
	}
	return this.marker;
};
