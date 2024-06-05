import React, { useCallback, useEffect, useReducer, useRef, useState, useMemo } from 'react'
import { useHistory } from "react-router";
import { useAPI } from "../../providers/ApiProvider";
import { useAPINew } from "../../providers/ApiProviderNew";

export const NewProject = ({ projectName, src, curProjectId, projects }) => {

  console.log('NewProject--', projectName, src, 'curProjectId--', curProjectId, projects)
  const [project, setProject] = useState();
  const history = useHistory();
  const api = useAPI();
  const apiNew = useAPINew();
  const [csvHandling, setCsvHandling] = useState(); // undefined | choose | tasks | ts
  let htmlStr = '<View>' +
                  '<Image name="image" value="$ocr"/>' +
                  '<Labels name="label" toName="image">' +
                    '<Label value="Text" background="green"/>' +
                    '<Label value="Handwriting" background="blue"/>' +
                  '</Labels>' +
                  '<Rectangle name="bbox" toName="image" strokeWidth="3"/>' +
                  '<Polygon name="poly" toName="image" strokeWidth="3"/>' +
                  '<TextArea name="transcription" toName="image" editable="true" perRegion="true" required="true" maxSubmissions="1" rows="5" placeholder="Recognized Text" displayMode="region-list" />' +
                '</View>'
  const [config, setConfig] = useState(htmlStr);
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState("");
  const projectBody = useMemo(
    () => ({
      title: name,
      description,
      label_config: config,
    }),
    [name, description, config],
  );

  const loadFilesList = (file_upload_ids, projectId) => {
    const query = {};
    if (file_upload_ids) {
      query.ids = JSON.stringify(file_upload_ids);
      api.callApi("fileUploads", {
        params: { pk: projectId, ...query },
      }).then(files => {
        reimportFiles(projectId, file_upload_ids)
      })
    }
  }

  const reimportFiles = (projectId, fileIds) => {
    api.callApi("reimportFiles", {
      params: {
        pk: projectId,
      },
      body: {
        file_upload_ids: fileIds,
        files_as_tasks_list: csvHandling === "tasks",
      },
    }).then(res => {
      // 查询标注页面id
      checkTask(projectId)
    })
  }

  /* 查询标注页面id ==> 缺少：api/dm/views ==> tab=47 ==> task=17 */
  const checkTask = (projectId) => {
    apiNew.callApi("checkTask", {
      params: { projectId: projectId }
    }).then(res => {
      console.log('checkTask----', res)
      let path = ''
      if(res&&res.task_id) {
        path = '&task=' + res.task_id
      }
      // http://localhost:8080/projects/141/data?tab=47&task=17
      // api/dm/views ==> tab=47 ==> task=17
      history.push(`/projects/${projectId}/data`);
    })
  }

  const importFiles = (files, body, projectId) => {
    const query = { commit_to_project: "false" };
    const contentType =
      body instanceof FormData
        ? "multipart/form-data" // usual multipart for usual files
        : "application/x-www-form-urlencoded"; // chad urlencoded for URL uploads
    api.callApi("importFiles", {
      params: { pk: projectId, ...query },
      headers: { "Content-Type": contentType },
      body,
      errorFilter: () => true,
    }).then(res => {
      if (res && !res.error) {
        const { could_be_tasks_list, data_columns, file_upload_ids } = res;
        loadFilesList(file_upload_ids, projectId)
      }
    })
  }

  const createProject = () => {
    api.callApi("createProject", {
      body: projectBody
    }).then(project => {
      console.log('createProject----', project.id, project, src)
      setProject(project)
      if(project.id) {
        // 上传图片
        const url = src
        const body = new URLSearchParams({ url });
        importFiles([{ name: url }], body, project.id);
      }
    })
  }

  const updateProject = () => {
    let project = projects.find(p => p.id === curProjectId)
    setProject(project)
    // 上传图片
    const url = src
    const body = new URLSearchParams({ url });
    importFiles([{ name: url }], body, project.id);
  }

  console.log('init----', curProjectId, project, projects)

  useEffect(() => {
    setName(projectName ? projectName : project.title)
    function componentDidMount() {
      if(!curProjectId) {
        // 新建项目，并上传图片 ==》查找task_id，跳转到图片标注页面
        createProject()
      } else {
        // 项目已存在，在该项目下上传图片 ==》查找task_id，跳转到图片标注页面
        updateProject()
      }
    }
    componentDidMount();
  }, []);

  return (
    <div>temp</div>
  )
}

