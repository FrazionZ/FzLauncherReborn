import React, { useState } from 'react';

const DoubleClickComponent = ({ callback }) => {
    const [clickCount, setClickCount] = useState(0);
    const [lastClickTime, setLastClickTime] = useState(0);

    const handleClick = () => {
        console.log('cc')
        const now = new Date().getTime();
        if (clickCount === 1 && now - lastClickTime < 300) {
            if (callback) callback()
            setClickCount(0);
        } else {
            setClickCount(1);
            setTimeout(() => {
                setClickCount(0);
            }, 300);
            setLastClickTime(now);
        }
    };

    return (
        <div onClick={handleClick} />
    );
};

export default DoubleClickComponent;