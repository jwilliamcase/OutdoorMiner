// Basic browser compatibility tests
export function runBrowserTests() {
    const tests = {
        'Canvas Support': () => {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext && canvas.getContext('2d'));
        },
        'WebSocket Support': () => {
            return 'WebSocket' in window;
        },
        'Local Storage': () => {
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    const results = Object.entries(tests).map(([name, test]) => {
        try {
            const passed = test();
            console.log(`Browser Test - ${name}: ${passed ? 'PASSED' : 'FAILED'}`);
            return { name, passed };
        } catch (error) {
            console.error(`Browser Test Error - ${name}:`, error);
            return { name, passed: false, error };
        }
    });

    return results.every(r => r.passed);
}
