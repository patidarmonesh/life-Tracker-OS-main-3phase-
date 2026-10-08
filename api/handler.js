import route from '../server/routes.js'

// Plain Vercel functions need an explicit rewrite for nested API paths.
export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.searchParams.get('lifeosRoute')
  if (path !== null) {
    url.searchParams.delete('lifeosRoute')
    url.pathname = `/api/${path}`
    req.url = `${url.pathname}${url.search}`
  }
  return route(req, res)
}
