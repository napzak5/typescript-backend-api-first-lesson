import { EnvironmentBanner } from '@beauty-salon-frontend/ui'
import { Link, Route, Routes } from 'react-router'
import styles from './App.module.css'

const HomePage = () => (
  <>
    <h1>{import.meta.env.VITE_APP_TITLE}</h1>
    <p>画面は準備中です。</p>
  </>
)

const NotFoundPage = () => (
  <>
    <h1>ページが見つかりません</h1>
    <p>アドレスが正しいか、お確かめください。</p>
    <p>
      <Link to='/'>トップへ戻る</Link>
    </p>
  </>
)

export const App = () => (
  <div className={styles['frame']}>
    <header className={styles['header']}>
      <p className={styles['title']}>{import.meta.env.VITE_APP_TITLE}</p>
    </header>
    <main className={styles['main']}>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='*' element={<NotFoundPage />} />
      </Routes>
    </main>
    <EnvironmentBanner environment={import.meta.env.VITE_MODE} />
  </div>
)
