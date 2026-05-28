import {NewPagePattern} from "@/components/module-patterns/NewPagePattern";
import DynamicComponent from "./component.positions";

type PageProps = {
  params: Promise<{locale: string}>;
};

export default async function DynamicNewPage({params}: PageProps) {
  return (
    <NewPagePattern
      title="positions"
      description="positions"
    >
      <DynamicComponent />
    </NewPagePattern>
  );
}