interface Props {
  subtitulo?: string;
}

export default function Marca({ subtitulo = 'Campus UCB · La Paz' }: Props) {
  return (
    <a className="marca" href="/">
      <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#fff" />
        <path d="M16 5.5c-4.4 0-8 3.4-8 7.8 0 5.6 8 13.2 8 13.2s8-7.6 8-13.2c0-4.4-3.6-7.8-8-7.8z" fill="#f7941d" />
        <circle cx="16" cy="13.2" r="3.2" fill="#2e3192" />
      </svg>
      <span>
        <span className="marca-nombre">¿Dónde es?</span>
        <small>{subtitulo}</small>
      </span>
    </a>
  );
}
