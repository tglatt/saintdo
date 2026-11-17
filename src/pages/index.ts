import type { APIRoute } from 'astro';

// Le site vitrine est sur WordPress (saindo.org) ; l'application ne sert que
// l'espace membre, l'admin et les API. La racine renvoie vers la connexion.
export const GET: APIRoute = ({ redirect }) => redirect('/login', 302);
