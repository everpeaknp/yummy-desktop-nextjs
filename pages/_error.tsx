import type { NextPageContext } from "next";

// Minimal error page for the Pages Router.
// App Router has its own error boundaries; this exists only to keep `next build`
// happy in environments where Next expects Pages Router internals.
function Error({ statusCode }: { statusCode?: number }) {
  return (
    <p>
      {statusCode
        ? `An error ${statusCode} occurred on server`
        : "An error occurred on client"}
    </p>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? (err as any).statusCode : 404;
  return { statusCode };
};

export default Error;

