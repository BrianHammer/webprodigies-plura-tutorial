import React from "react";

const Page = ({ params }: { params: { agencyId: string } }) => {
  return <div>{params.agencyId}</div>;
};

export default Page;
