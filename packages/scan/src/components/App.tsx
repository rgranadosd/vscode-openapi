import styled from "styled-components";
import { useAppSelector } from "../store/hooks";
import ThemeStyles from "@xliic/web-theme/ThemeStyles";
import Response from "./Response";
import Error from "./Error";
import ScanOperation from "./ScanOperation";
import TryOperation from "./TryOperation";
import ScanReport from "./ScanReport";
import { OasState } from "../store/oasSlice";

const routes: Record<OasState["page"], JSX.Element> = {
  scanOperation: <ScanOperation />,
  tryOperation: <TryOperation />,
  scanReport: <ScanReport />,
  response: <Response />,
  error: <Error />,
  loading: <div>Loading...</div>,
};

function App() {
  const theme = useAppSelector((state) => state.theme);
  const { page } = useAppSelector((state) => state.oas);

  return (
    <>
      <ThemeStyles theme={theme} />
      <Container>{routes[page]}</Container>
    </>
  );
}

const Container = styled.div``;

export default App;