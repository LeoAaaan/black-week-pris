export default function Home() {
  return (
    <main>
      <h1>Black Week-pris API</h1>
      <ul>
        <li><a href="/api/search?q=airpods">/api/search?q=airpods</a></li>
        <li><a href="/api/suggest?q=airpd">/api/suggest?q=airpd</a></li>
        <li><a href="/api/search?sort=discount&amp;inStock=1">/api/search?sort=discount&amp;inStock=1</a></li>
      </ul>
    </main>
  );
}
