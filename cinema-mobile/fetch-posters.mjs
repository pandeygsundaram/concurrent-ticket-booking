const API_KEY = '664c8904abcda021c3dd6976ff7e5a00'

const movies = [
  "Interstellar",
  "Dune",
  "Dune: Part Two",
  "Avatar",
  "Avatar: The Way of Water",
  "Oppenheimer",
  "The Batman",
  "Top Gun: Maverick",
  "John Wick: Chapter 4",
  "Mission: Impossible – Dead Reckoning",
  "Spider-Man: Across the Spider-Verse",
  "The Super Mario Bros. Movie",
  "Inside Out 2",
  "Deadpool & Wolverine",
  "F1",
  "The Wild Robot",
  "How to Train Your Dragon",
  "Sinners",
  "Mickey 17",
  "The Fantastic Four: First Steps",
  "Elio",
  "Thunderbolts*",
  "Wicked",
  "Wonka",
  "Gladiator II",
]

const BASE_IMAGE = 'https://image.tmdb.org/t/p/w500'

async function fetchPoster(title) {
  const encoded = encodeURIComponent(title)
  const url = `https://api.themoviedb.org/3/search/movie?query=${encoded}&api_key=${API_KEY}&language=en-US&page=1`
  const res = await fetch(url)
  const data = await res.json()
  const movie = data.results?.[0]
  if (!movie) return { title, poster: null, id: null }
  return {
    title,
    id: movie.id,
    poster: movie.poster_path ? `${BASE_IMAGE}${movie.poster_path}` : null,
    year: movie.release_date?.slice(0, 4) ?? null,
  }
}

const results = []
for (const title of movies) {
  const data = await fetchPoster(title)
  results.push(data)
  console.log(`${data.poster ? '✓' : '✗'} ${title}`)
}

import { writeFileSync } from 'fs'
writeFileSync('./movies.json', JSON.stringify(results, null, 2))
console.log('\nSaved to movies.json')
