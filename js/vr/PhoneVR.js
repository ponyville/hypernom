"use strict";

// It seems to be impossible to synchronously detect whether we have an orientation sensor.
// Even Chromium on the desktop has a 'deviceorientation' event, and it will fire once with
// all nulls.

function PhoneVR() {
    this.deviceAlpha = null;
    this.deviceGamma = null;
    this.deviceBeta = null;

    this.lastQuaternion = null;

    window.addEventListener('deviceorientation', function(orientation) {
        this.deviceAlpha = orientation.alpha;
        this.deviceGamma = orientation.gamma;
        this.deviceBeta = orientation.beta;
    }.bind(this));
}

PhoneVR.prototype.requestEventPermission = function() {
    if (DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission().then(function (permissionState) {
            // Simply log the result, not much more we can do here.
            // We could tell the user that they need to manually give permission if they've denied it in the past.
            if (permissionState === "granted") {
                console.log('Access to DeviceOrientationEvent granted.');
            } else {
                console.log('Access to DeviceOrientationEvent denied.');
            }
        });
    }
};

PhoneVR.prototype.orientationIsAvailable = function() {
    return this.deviceAlpha !== null;
}

PhoneVR.prototype.rotationQuat = function() {
    if (!this.orientationIsAvailable())
        return null;

    var degtorad = Math.PI / 180; // Degree-to-Radian conversion
    var z = this.deviceAlpha * degtorad / 2;
    var x = this.deviceBeta * degtorad / 2;
    var y = this.deviceGamma * degtorad / 2;
    var cX = Math.cos(x);
    var cY = Math.cos(y);
    var cZ = Math.cos(z);
    var sX = Math.sin(x);
    var sY = Math.sin(y);
    var sZ = Math.sin(z);

    // ZXY quaternion construction.
    var w = cX * cY * cZ - sX * sY * sZ;
    var x = sX * cY * cZ - cX * sY * sZ;
    var y = cX * sY * cZ + sX * cY * sZ;
    var z = cX * cY * sZ + sX * sY * cZ;

    var deviceQuaternion = quat.fromValues(x, y, z, w);

    // Implement lift from SO(3) to S^3

    if(this.lastQuaternion !== null){
        var difference = [];
        var deviceQuaternionInverse = [];
        quat.invert(deviceQuaternionInverse, deviceQuaternion);
        quat.multiply(difference, this.lastQuaternion, deviceQuaternionInverse);
        if(difference[3] < 0.0){
            quat.scale(deviceQuaternion, deviceQuaternion, -1);
        }
    }
    this.lastQuaternion = deviceQuaternion;

    // Correct for the screen orientation.
    var screenOrientation = (this.getScreenOrientation() * degtorad)/2;
    var screenTransform = [0, 0, -Math.sin(screenOrientation), Math.cos(screenOrientation)];

    var deviceRotation = quat.create();
    quat.multiply(deviceRotation, deviceQuaternion, screenTransform);

    // deviceRotation is the quaternion encoding of the transformation
    // from camera coordinates to world coordinates.  The problem is that
    // our shader uses conventional OpenGL coordinates
    // (+x = right, +y = up, +z = backward), but the DeviceOrientation
    // spec uses different coordinates (+x = East, +y = North, +z = up).
    // To fix the mismatch, we need to fix this.  We'll arbitrarily choose
    // North to correspond to -z (the default camera direction).
    var r22 = Math.sqrt(0.5);
    quat.multiply(deviceRotation, quat.fromValues(-r22, 0, 0, r22), deviceRotation);

    var formattedOrientation = {};
    formattedOrientation.x = deviceRotation[0];
    formattedOrientation.y = deviceRotation[1];
    formattedOrientation.z = deviceRotation[2];
    formattedOrientation.w = deviceRotation[3];
    return formattedOrientation;
}

PhoneVR.prototype.getScreenOrientation = function() {
  switch (window.screen.orientation || window.screen.mozOrientation) {
    case 'landscape-primary':
      return 90;
    case 'landscape-secondary':
      return -90;
    case 'portrait-secondary':
      return 180;
    case 'portrait-primary':
      return 0;
  }
  if (window.orientation !== undefined)
    return window.orientation;
}
