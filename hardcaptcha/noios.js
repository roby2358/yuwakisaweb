// iOS Detection
// Provides iOS detection utilities

class IOSDetector {
    static isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
}

// Expose globally for backward compatibility
window.isIOS = IOSDetector.isIOS;

