// Shared Utility Functions

/**
 * Clamp a value to a range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Gaussian function: e^(-(x²)/(2σ²))
 * @param {number} x - Distance or value
 * @param {number} sigma - Standard deviation
 * @returns {number} Value between 0 and 1
 */
export function gaussian(x, sigma) {
    return Math.exp(-(x * x) / (2 * sigma * sigma));
}

/**
 * Sum an array of numbers.
 * @param {number[]} array
 * @returns {number}
 */
export function sum(array) {
    return array.reduce((acc, val) => acc + val, 0);
}

/**
 * Find the maximum value in an array by a key function.
 * @param {Array} array
 * @param {Function} keyFn - Function to extract comparable value
 * @returns {*} Element with maximum key value, or null if empty
 */
export function maxBy(array, keyFn) {
    if (array.length === 0) return null;
    let maxItem = array[0];
    let maxKey = keyFn(array[0]);
    for (let i = 1; i < array.length; i++) {
        const key = keyFn(array[i]);
        if (key > maxKey) {
            maxKey = key;
            maxItem = array[i];
        }
    }
    return maxItem;
}

/**
 * Find the minimum value in an array by a key function.
 * @param {Array} array
 * @param {Function} keyFn - Function to extract comparable value
 * @returns {*} Element with minimum key value, or null if empty
 */
export function minBy(array, keyFn) {
    if (array.length === 0) return null;
    let minItem = array[0];
    let minKey = keyFn(array[0]);
    for (let i = 1; i < array.length; i++) {
        const key = keyFn(array[i]);
        if (key < minKey) {
            minKey = key;
            minItem = array[i];
        }
    }
    return minItem;
}
