
      // This example requires the Visualization library. Include the libraries=visualization
      // parameter when you first load the API. For example:
      // <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=visualization">

      var map, heatmap, heatLocations;
        initMap();

       async function initMap() {
        let center = this.mapCenter ? {lat: this.mapCenter.lat, lng: this.mapCenter.lng} : {lat: 0, lng: 0};//TODO CHANGE DEFAULTS
        //let center = await findCenter(locationStr); //augment with max demand property if not found (with lodash)
        console.log(center);
        map = new google.maps.Map(document.getElementById('map'), {
          zoom: 10,
          center: center,
          //mapTypeId: 'satellite', //CHANGE
            mapTypeId: google.maps.MapTypeId.HYBRID,

          labels: true
        });
        var infoWindow = new google.maps.InfoWindow;
        findCenter(locationStr);
        heatmap = new google.maps.visualization.HeatmapLayer({
        data: await getPoints(this.weightedLocations), //TODO check it defined!, create default
          map: map
        });
      }

      function toggleHeatmap() {
        heatmap.setMap(heatmap.getMap() ? null : map);
      }

      function changeGradient() {
        var gradient = [
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
                    position: {lat: coordinate.lat, lng: coordinate.lng},
                    map: map,
                   /*icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 2
          },*/
                    title: `demand: ${coordinate.demand}`
               });
          });
      }       

      function findCenter(locationStr) {
          // //TODO if (!locationStr) {...};
          const geocoder = new google.maps.Geocoder();
               geocoder.geocode({'address': locationStr}, (results, status) => {
                    if (status === 'OK') {
                         map.setCenter(results[0].geometry.location);
                         console.log(results[0].formatted_address);

                    } else {
                         console.log('geocoder could not find location ' + locationStr)
                         //use other method to center map
                    }
               });
      } 
      