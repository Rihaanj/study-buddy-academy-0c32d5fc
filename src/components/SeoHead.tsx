import { Helmet } from "react-helmet-async";

const BASE = "https://study-buddy-academy.lovable.app";

type Props = {
  title: string;
  description: string;
  path: string; // e.g. "/help"
  jsonLd?: object;
};

export const SeoHead = ({ title, description, path, jsonLd }: Props) => {
  const url = `${BASE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};
