import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.roles";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  return (
    <NewPagePattern
      title="roles"
      description="roles"
      plain={true}
    >
      <DynamicComponent />
    </NewPagePattern>
  );
}