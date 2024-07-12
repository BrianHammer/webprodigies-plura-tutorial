import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { Plus } from "lucide-react";
import React from "react";
import DataTable from "./data-table";
import { columns } from "./columns";

type Props = {
  params: { agencyId: string };
};

const TeamPage = async ({ params }: Props) => {
  const authUser = await currentUser();
  if (!authUser) return null;

  const teamMembers = await db.user.findMany({
    where: {
      Agency: { id: params.agencyId },
    },
    include: {
      Agency: {
        include: { SubAccount: true },
      },
      Permissions: { include: { SubAccount: true } },
    },
  });

  const agencyDetails = await db.agency.findUnique({
    where: { id: params.agencyId },
    include: { SubAccount: true },
  });

  if (!agencyDetails) return;

  return (
    <DataTable
      actionButtonText={
        <>
          <Plus size={15} /> Add
        </>
      }
      modalChildren={<></>}
      filterValue="name"
      columns={columns}
      data={teamMembers}
    ></DataTable>
  );
};

export default TeamPage;
