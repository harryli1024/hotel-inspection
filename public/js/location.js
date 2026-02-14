const GPS = {
  getCurrentPosition(timeout) {
    timeout = timeout || 10000;
    return new Promise(function(resolve) {
      if (!navigator.geolocation) {
        resolve({ lat: null, lng: null, accuracy: null, error: '设备不支持定位' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            error: null,
          });
        },
        function(err) {
          resolve({
            lat: null, lng: null, accuracy: null,
            error: err.message || '定位失败',
          });
        },
        { enableHighAccuracy: true, timeout: timeout, maximumAge: 0 }
      );
    });
  },
};
