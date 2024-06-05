import React, { useState } from "react";
import { useParams as useRouterParams } from "react-router";
import { Redirect } from "react-router-dom";
import { Button } from "../../components";
import { Oneof } from "../../components/Oneof/Oneof";
import { Spinner } from "../../components/Spinner/Spinner";
import { ApiContext } from "../../providers/ApiProvider";
import { ApiContextNew } from "../../providers/ApiProviderNew";
import { useContextProps } from "../../providers/RoutesProvider";
import { useAbortController } from "../../hooks/useAbortController";
import { Block, Elem } from "../../utils/bem";
import { FF_DEV_2575, isFF } from "../../utils/feature-flags";
import { CreateProject } from "../CreateProject/CreateProject";
import { NewProject } from "../AddProjectAndImg/NewProject";
import { DataManagerPage } from "../DataManager/DataManager";
import { SettingsPage } from "../Settings";
import "./Projects.styl";
import { EmptyProjectsList, ProjectsList } from "./ProjectsList";

const getCurrentPage = () => {
  const pageNumberFromURL = new URLSearchParams(location.search).get("page");

  return pageNumberFromURL ? Number.parseInt(pageNumberFromURL) : 1;
};

export const ProjectsPage = () => {
  const api = React.useContext(ApiContext);
  const apiNew = React.useContext(ApiContextNew);
  const abortController = useAbortController();
  const [projectsList, setProjectsList] = React.useState([]);
  const [networkState, setNetworkState] = React.useState(null);
  const [currentPage, setCurrentPage] = useState(getCurrentPage());
  const [totalItems, setTotalItems] = useState(1);
  const setContextProps = useContextProps();
  const defaultPageSize = Number.parseInt(localStorage.getItem("pages:projects-list") ?? 30);
  const [projectId, setProjectId] = React.useState('');
  const [src, setSrc] = React.useState('');
  const [projectName, setProjectName] = React.useState('');

  const [modal, setModal] = React.useState(false);
  const openModal = setModal.bind(null, true);
  const closeModal = setModal.bind(null, false);

  const params = new URLSearchParams(window.location.search); // 获取url参数
  console.log('params---', params, 'projectId--', projectId)
  if(params) {
    let username = params.get('username')
    let labelCategory = params.get('labelCategory')
    let src1 = params.get('src')
    // 导入图片，并校验项目是否已存在
    let name = username + '[' + labelCategory + ']'
    // 根据项目名称和邮箱，查询项目是否存在，若存在，上传图片；若不存在，新建项目后再上传图片
    const checkProjects = () => {
      apiNew.callApi("checkProjects", {
        params: { email: '1005332312@qq.com', projectName: projectName },
      }).then(res => {
        console.log('checkProjects--res---', res, projectName)
        if(res&&res.project_id) {
          setProjectId(res.project_id);
        } else {
          setProjectId('');
        }
      })
    }
    React.useEffect(() => {
      setSrc(src1);
      setProjectName(name);
      checkProjects();
    }, []);
  }

  const fetchProjects = async (page = currentPage, pageSize = defaultPageSize) => {
    setNetworkState("loading");
    abortController.renew(); // Cancel any in flight requests

    const requestParams = { page, page_size: pageSize };

    if (isFF(FF_DEV_2575)) {
      requestParams.include = [
        "id",
        "title",
        "created_by",
        "created_at",
        "color",
        "is_published",
        "assignment_settings",
      ].join(",");
    }

    const data = await api.callApi("projects", {
      params: requestParams,
      ...(isFF(FF_DEV_2575)
        ? {
            signal: abortController.controller.current.signal,
            errorFilter: (e) => e.error.includes("aborted"),
          }
        : null),
    });

    setTotalItems(data?.count ?? 1);
    setProjectsList(data.results ?? []);
    setNetworkState("loaded");

    if (isFF(FF_DEV_2575) && data?.results?.length) {
      const additionalData = await api.callApi("projects", {
        params: {
          ids: data?.results?.map(({ id }) => id).join(","),
          include: [
            "id",
            "description",
            "num_tasks_with_annotations",
            "task_number",
            "skipped_annotations_number",
            "total_annotations_number",
            "total_predictions_number",
            "ground_truth_number",
            "finished_task_number",
          ].join(","),
          page_size: pageSize,
        },
        signal: abortController.controller.current.signal,
        errorFilter: (e) => e.error.includes("aborted"),
      });

      if (additionalData?.results?.length) {
        setProjectsList((prev) =>
          additionalData.results.map((project) => {
            const prevProject = prev.find(({ id }) => id === project.id);

            return {
              ...prevProject,
              ...project,
            };
          }),
        );
      }
    }
  };

  const loadNextPage = async (page, pageSize) => {
    setCurrentPage(page);
    await fetchProjects(page, pageSize);
  };

  React.useEffect(() => {
    fetchProjects();
  }, []);

  React.useEffect(() => {
    // there is a nice page with Create button when list is empty
    // so don't show the context button in that case
    setContextProps({ openModal, showButton: projectsList.length > 0 });
  }, [projectsList.length]);

  return (
    <Block name="projects-page">
      <Oneof value={networkState}>
        <Elem name="loading" case="loading">
          <Spinner size={64} />
        </Elem>
        <Elem name="content" case="loaded">
          <NewProject
            curProjectId={projectId}
            projectName={projectName}
            src={src}
            projects={projectsList}
          />

          {/* {projectsList.length ? (
            <ProjectsList
              projects={projectsList}
              currentPage={currentPage}
              totalItems={totalItems}
              loadNextPage={loadNextPage}
              pageSize={defaultPageSize}
            />
          ) : (
            <EmptyProjectsList openModal={openModal} />
          )} */}
          {modal && <CreateProject onClose={closeModal} />}
        </Elem>
      </Oneof>
    </Block>
  );
};

ProjectsPage.title = "Projects";
ProjectsPage.path = "/projects";
ProjectsPage.exact = true;
ProjectsPage.routes = ({ store }) => [
  {
    title: () => store.project?.title,
    path: "/:id(\\d+)",
    exact: true,
    component: () => {
      const params = useRouterParams();

      return <Redirect to={`/projects/${params.id}/data`} />;
    },
    pages: {
      DataManagerPage,
      SettingsPage,
    },
  },
];
ProjectsPage.context = ({ openModal, showButton }) => {
  if (!showButton) return null;
  return (
    <Button onClick={openModal} look="primary" size="compact">
      Create
    </Button>
  );
};
