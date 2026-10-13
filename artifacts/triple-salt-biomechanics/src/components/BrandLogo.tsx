export default function BrandLogo() {
  return (
    <img
      className="brand-mark brand-logo"
      src={`${import.meta.env.BASE_URL}images/app-logo.jpg`}
      alt="Logotip d’A peu de pista"
      width={64}
      height={64}
      decoding="async"
    />
  );
}
