import React, { useEffect } from 'react';

const Map: React.FC = () => {
    useEffect(() => {
        // Load the map script
        const script = document.createElement('script');
        script.src = '/map.js';
        script.type = 'module';
        document.body.appendChild(script);

        return () => {
            // Cleanup the script when the component is unmounted
            document.body.removeChild(script);
        };
    }, []);

    return <div id='map' style={{ height: '100vh' }}></div>;
};

export default Map;
