import { Link } from "react-router";
import { DEFAULT_PATH } from "../routes.js";

export default function NotFoundPage() {
  return (
    <section className="page">
      <h2>Página não encontrada</h2>
      <p className="empty-state">
        O endereço acessado não existe. <Link to={DEFAULT_PATH}>Voltar para Meus Jogadores</Link>
      </p>
    </section>
  );
}
