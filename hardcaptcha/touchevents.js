// Touch Event Handler
// Provides touch event handling utilities

class TouchEventHandler {
    constructor(options = {}) {
        this.options = {
            enableLogging: options.enableLogging !== false,
            touchDelay: options.touchDelay || 300,
            maxTouchEvents: options.maxTouchEvents || 50,
            onTouchEvent: options.onTouchEvent || null,
            ...options
        };
        
        this.touchEvents = [];
        this.platformInfo = TouchEventHandler.getPlatformInfo();
        
        if (this.options.enableLogging) {
            console.log('TouchEventHandler initialized');
            console.log('Platform Info:', this.platformInfo);
            
            if (this.platformInfo.isIOS) {
                console.log('iOS detected - touch event handling enabled');
            }
        }
    }
    
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
    }
    
    static getPlatformInfo() {
        return {
            isIOS: IOSDetector.isIOS(),
            isMobile: TouchEventHandler.isMobile(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            hasTouchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0
        };
    }
    
    getPlatformInfo() {
        return this.platformInfo;
    }
    
    setupTouchTracking(element = document) {
        if (!this.platformInfo.hasTouchSupport) {
            return;
        }
        
        this.touchEvents = [];
        
        element.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touchData = {
                    type: 'touchstart',
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                    time: Date.now(),
                    target: e.target.tagName + (e.target.className ? '.' + e.target.className : '')
                };
                
                this.touchEvents.push(touchData);
                
                if (this.touchEvents.length > this.options.maxTouchEvents) {
                    this.touchEvents.shift();
                }
                
                if (this.options.onTouchEvent) {
                    this.options.onTouchEvent(touchData);
                }
                
                if (this.options.enableLogging && this.platformInfo.isIOS) {
                    console.log('Touch start:', {
                        target: touchData.target,
                        x: touchData.x,
                        y: touchData.y
                    });
                }
            }
        });
        
        element.addEventListener('touchend', (e) => {
            if (e.changedTouches.length > 0) {
                const touchData = {
                    type: 'touchend',
                    x: e.changedTouches[0].clientX,
                    y: e.changedTouches[0].clientY,
                    time: Date.now(),
                    target: e.target.tagName + (e.target.className ? '.' + e.target.className : '')
                };
                
                this.touchEvents.push(touchData);
                
                if (this.touchEvents.length > this.options.maxTouchEvents) {
                    this.touchEvents.shift();
                }
                
                if (this.options.onTouchEvent) {
                    this.options.onTouchEvent(touchData);
                }
                
                if (this.options.enableLogging && this.platformInfo.isIOS) {
                    console.log('Touch end:', {
                        target: touchData.target,
                        x: touchData.x,
                        y: touchData.y
                    });
                }
            }
        });
    }
    
    createTouchHandler(handlerFunction) {
        let lastTouchTime = 0;
        const TOUCH_DELAY = this.options.touchDelay;
        
        return (e) => {
            const now = Date.now();
            
            if (e.type === 'touchend') {
                e.preventDefault();
                e.stopPropagation();
                lastTouchTime = now;
            } else if (e.type === 'click') {
                if (now - lastTouchTime < TOUCH_DELAY) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            
            handlerFunction(e);
        };
    }
    
    attachTouchHandler(element, handlerFunction) {
        const touchHandler = this.createTouchHandler(handlerFunction);
        element.addEventListener('click', touchHandler);
        element.addEventListener('touchend', touchHandler, { passive: false });
    }
    
    getTouchEvents() {
        return [...this.touchEvents];
    }
    
    clearTouchEvents() {
        this.touchEvents = [];
    }
}

// Expose static methods globally for backward compatibility
window.getPlatformInfo = TouchEventHandler.getPlatformInfo;
window.isMobile = TouchEventHandler.isMobile;

