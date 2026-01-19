/**
 * ScrollingText Component
 * 
 * A reusable component that displays text and scrolls it on hover
 * only when the text overflows its container.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The text content to display
 * @param {string} props.className - Optional CSS class for the inner text element
 * @param {string} props.containerClassName - Optional CSS class for the outer container
 * @param {string} props.as - HTML element to render for text (default: 'span')
 * @param {Function} props.onClick - Optional click handler
 * @param {Function} props.onKeyDown - Optional keydown handler
 * @param {string} props.role - Optional ARIA role
 * @param {number} props.tabIndex - Optional tabIndex
 */

import { memo, useState, useEffect, useRef } from 'react';
import styles from './ScrollingText.module.css';

const ScrollingText = memo(function ScrollingText({
  children,
  className = '',
  containerClassName = '',
  as: Component = 'span',
  onClick,
  onKeyDown,
  role,
  tabIndex,
}) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef(null);
  const containerRef = useRef(null);

  // Check if text overflows its container
  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current && containerRef.current) {
        const textWidth = textRef.current.scrollWidth;
        const containerWidth = containerRef.current.clientWidth;
        setIsOverflowing(textWidth > containerWidth);
      }
    };
    
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [children]);

  const containerClasses = [
    styles.container,
    isOverflowing ? styles.canScroll : '',
    containerClassName,
  ].filter(Boolean).join(' ');

  const textClasses = [
    styles.text,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} ref={containerRef}>
      <Component
        className={textClasses}
        ref={textRef}
        onClick={onClick}
        onKeyDown={onKeyDown}
        role={role}
        tabIndex={tabIndex}
      >
        {children}
      </Component>
    </div>
  );
});

export default ScrollingText;
