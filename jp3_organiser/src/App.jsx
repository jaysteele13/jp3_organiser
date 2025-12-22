import styles from './App.module.css'
import About from './pages/About'
import Upload from './pages/Upload'

function App() {

  return (
    <main className={styles.container}>
      {/* <About/> */}
      <Upload/>
    </main>
  );
}

export default App;
