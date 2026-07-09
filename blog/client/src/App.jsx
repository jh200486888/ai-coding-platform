import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Post from './pages/Post';

export default function App() {
  return (
    <>
      <nav>
        <div className="container">
          <Link to="/" className="logo">📝 我的博客</Link>
          <div>
            <Link to="/">首页</Link>
            <a href="https://github.com" target="_blank" rel="noopener">GitHub</a>
          </div>
        </div>
      </nav>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:slug" element={<Post />} />
        </Routes>
      </main>

      <footer>
        <div className="container">
          &copy; {new Date().getFullYear()} 我的博客 &mdash; Powered by React + Express
        </div>
      </footer>
    </>
  );
}
