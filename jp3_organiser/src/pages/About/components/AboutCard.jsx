import styles from './AboutCard.module.css';
export default function AboutCard({ description }) {

    // Parse to bold text wrapped in **
    const parseDescription = (text) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <b key={index}>{part.slice(2, -2)}</b>;
            }
            return part;
        }
    );
    };


  return (
    <>
     <section className={styles.Section}>
            <p className={styles.fadeIn}>
                {parseDescription(description)}
            </p>
    </section>
    </>
  );
}