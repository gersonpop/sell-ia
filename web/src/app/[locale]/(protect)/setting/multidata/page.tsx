import {requireProtectedSettingContext} from "../layout";
import {DataManager} from "./component.multidata";


type SettingsMultidataPageProps = {
  params: Promise<{locale: string}>;
};

export default async function SettingsMultidataPage({params}: SettingsMultidataPageProps) {
  const {locale} = await params;
  await requireProtectedSettingContext(locale);

  return <DataManager ></DataManager>
 // return <NewPagePattern title={current?.description || current?.name || "Multidata"} description="Modelo newPage dentro de contentSidebar." />;
}
