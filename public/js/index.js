let map, heatmap, heatLocations;
initMap();

async function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 10,
    center: {lat: 0, lng: 0},
    mapTypeId: google.maps.MapTypeId.HYBRID,
    labels: true
  });
  centerMap(locationStr);
  heatmap = new google.maps.visualization.HeatmapLayer({
    data: await getPoints(this.weightedLocations),
    map: map
  });
}

function toggleHeatmap() {
  heatmap.setMap(heatmap.getMap() ? null : map);
}

function changeGradient() {
  const gradient = [
    'rgba(0, 255, 255, 0)',
    'rgba(0, 255, 255, 1)',
    'rgba(0, 191, 255, 1)',
    'rgba(0, 127, 255, 1)',
    'rgba(0, 63, 255, 1)',
    'rgba(0, 0, 255, 1)',
    'rgba(0, 0, 223, 1)',
    'rgba(0, 0, 191, 1)',
    'rgba(0, 0, 159, 1)',
    'rgba(0, 0, 127, 1)',
    'rgba(63, 0, 91, 1)',
    'rgba(127, 0, 63, 1)',
    'rgba(191, 0, 31, 1)',
    'rgba(255, 0, 0, 1)'
  ]
  heatmap.set('gradient', heatmap.get('gradient') ? null : gradient);
}

function changeRadius() {
  heatmap.set('radius', heatmap.get('radius') ? null : 20);
}

function changeOpacity() {
  heatmap.set('opacity', heatmap.get('opacity') ? null : 0.2);
}

async function getPoints(weightedLocations) {
  if (!weightedLocations) return [];
  return weightedLocations.map(coordinate => {
    return {
      location: new google.maps.LatLng(coordinate.lat, coordinate.lng),
      weight: coordinate.demand ? coordinate.demand : 0
    };
  });
}

function showMarkers(locations) {
  if (!locations) return;
  return weightedLocations.map(coordinate => {
    return new google.maps.Marker({
      position: {
        lat: coordinate.lat,
        lng: coordinate.lng
      },
      map: map,
      title: `demand: ${coordinate.demand}`
    });
  });
}

function centerMap(locationStr) {
  if (!locationStr) return;
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({'address': locationStr}, (results, status) => {
    if (status === 'OK') {
      map.setCenter(results[0].geometry.location);
    } else {
      console.log('centerMap(): geocoder could not find location ' + locationStr)
    }
  });
}