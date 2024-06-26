import React from 'react';
import Form from 'react-bootstrap/Form';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Image from 'react-bootstrap/Image';
import Table from 'react-bootstrap/Table';
import Alert from 'react-bootstrap/Alert';
import InputGroup from 'react-bootstrap/InputGroup';
import Spinner from 'react-bootstrap/Spinner';
import { ReactWidget } from '@jupyterlab/apputils';
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

export async function requestAPI<T>(
  endPoint = '',
  init: RequestInit = {}
): Promise<T> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(
    settings.baseUrl,
    'jupyterlab-onyxia-composer', // API Namespace
    endPoint
  );

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
  } catch (error) {
    throw new ServerConnection.NetworkError(error as any);
  }

  let data: any = await response.text();

  if (data.length > 0) {
    try {
      data = JSON.parse(data);
    } catch (error) {
      console.warn('Not a JSON response body.', response);
    }
  }

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message || data);
  }

  return data;
}

const formStyle = {
  maxWidth: '700px',
  margin: '20px auto',
  padding: '20px',
  border: '1px solid #ddd',
  borderRadius: '10px',
  backgroundColor: '#f5f5f5'
};

const submitButtonStyle = {
  marginTop: '1.2em',
  backgroundColor: '#28a745',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  width: '100px'
};

const TitleStyle = {
  fontSize: '5em',
  color: '#ff562c'
};

export const OnyxiaComponent = (): JSX.Element => {
  const [tabKey, setTabKey] = React.useState('create');
  const [name, setName] = React.useState<string | undefined>(undefined);
  const [desc, setDesc] = React.useState<string>('');
  const [iconURL, setIconURL] = React.useState<string>('');
  const [dockerImageTag, setDockerImageTag] = React.useState<string>('0.0.1');
  const [notebookName, setNotebookName] = React.useState('index.ipynb');
  const [pythonFileName, setPythonFileName] = React.useState('index.py');
  const [message, setMessage] = React.useState<string>('');
  const [showMessage, setShowMessage] = React.useState(false);
  const [appBuildType, setAppBuildType] = React.useState<
    'fromRepo' | 'fromDockerImage' | 'fromLocalDirectory'
  >('fromRepo');
  const [appType, setAppType] = React.useState<
    'voila' | 'streamlit' | 'jupyterlab'
  >('voila');
  const [appRepoURL, setAppRepoURL] = React.useState<string | undefined>(
    undefined
  );
  const [revision, setRevision] = React.useState<string | undefined>(undefined);
  const [appImage, setAppImage] = React.useState<string | undefined>(undefined);
  const [appDir, setAppDir] = React.useState<string | undefined>(undefined);
  const [version, setVersion] = React.useState<string>('0.0.1');
  const [existedApp, setExistedApp] = React.useState(false);
  const [createdApp, setCreatedApp] = React.useState<string | undefined>(
    undefined
  );
  const [cpuLimit, setCpuLimit] = React.useState(1500);
  const [memLimit, setMemLimit] = React.useState(2);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreatedApp(name);
    const dataToSend = {
      name,
      version,
      desc,
      iconURL,
      dockerImageTag,
      notebookName,
      pythonFileName,
      appType,
      appBuildType,
      appRepoURL,
      revision,
      appImage,
      appDir,
      cpuLimit,
      memLimit
    };
    requestAPI<any>('create', {
      body: JSON.stringify(dataToSend),
      method: 'POST'
    })
      .then(reply => {
        setMessage(reply['message']);
        setShowMessage(true);
        setCreatedApp(undefined);
      })
      .catch(reason => {
        console.error(
          `Error on POST /jupyterlab-onyxia-composer/create ${dataToSend}.\n${reason}`
        );
      });
  };

  const handleServiceName = (name: string) => {
    setName(name);
    requestAPI<any>('checkSrvName', {
      body: JSON.stringify(name),
      method: 'POST'
    })
      .then(reply => {
        setVersion(reply.version);
        if (reply.exist) {
          setExistedApp(true);
          setDesc(reply.desc);
          setIconURL(reply.iconURL);
          setAppRepoURL(reply.appRepoURL);
          setNotebookName(reply.notebookName);
          setPythonFileName(reply.pythonFileName);
          setAppType(reply.appType);
          setAppBuildType(reply.appBuildType);
          setAppDir(reply.appDir);
          setCpuLimit(reply.cpuLimit);
          setMemLimit(reply.memLimit);
          setMessage(`WARNING: ${name} already exists, It will be updated`);
          setShowMessage(true);
          setDockerImageTag(reply.dockerImageTag);
        } else {
          setExistedApp(false);
          setMessage('');
          setShowMessage(false);
        }
      })
      .catch(reason => {
        console.error(
          `Error on POST /jupyterlab-onyxia-composer/checkSrvName ${appRepoURL}.\n${reason}`
        );
      });
  };

  const handleServiceVersion = (inputVersion: string) => {
    setVersion(inputVersion);
    requestAPI<any>('checkSrvVersion', {
      body: JSON.stringify({ name, version: inputVersion }),
      method: 'POST'
    })
      .then(reply => {
        const msg = reply['message'];
        if (msg) {
          setMessage(msg);
          setShowMessage(true);
        } else {
          setShowMessage(false);
        }
      })
      .catch(reason => {
        console.error(
          `Error on POST /jupyterlab-onyxia-composer/checkSrvVersion ${appRepoURL}.\n${reason}`
        );
      });
  };

  return (
    <div className="container">
      <h1 className="mb-3 text-center fw-bold" style={TitleStyle}>
        <Image
          src="https://www.onyxia.sh/static/media/Dragoon.8d89504cc3a892bf56ee9e7412df7d43.svg"
          style={{ height: '1em' }}
        />
        nyxia Service Composer
      </h1>
      <Tabs
        id="tabs"
        activeKey={tabKey}
        onSelect={k => setTabKey(k || '')}
        className="mb-3"
      >
        <Tab
          eventKey="create"
          title="Create Service"
          style={{ overflow: 'auto', height: '750px' }}
        >
          <Form onSubmit={handleSubmit} style={formStyle}>
            <h2>Service</h2>
            <Form.Group className="mb-3">
              <Row>
                <Col xs={9}>
                  <Form.Label>Name *</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    onChange={e => handleServiceName(e.currentTarget.value)}
                  />
                </Col>
                <Col>
                  <Form.Label>Version *</Form.Label>
                  <Form.Control
                    type="text"
                    value={version}
                    required
                    onChange={e => handleServiceVersion(e.currentTarget.value)}
                  />
                </Col>
              </Row>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                type="text"
                value={desc}
                onChange={e => setDesc(e.currentTarget.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Icon Url</Form.Label>
              <Form.Control
                type="text"
                value={iconURL}
                onChange={e => setIconURL(e.currentTarget.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Col xs>
                <Form.Label>Docker image tag</Form.Label>
                <Form.Control
                  type="text"
                  value={dockerImageTag}
                  onChange={e => setDockerImageTag(e.currentTarget.value)}
                />
              </Col>
            </Form.Group>
            <h3>Build Method</h3>
            <Form.Group className="mb-3">
              <Form.Group className="mb-3">
                <Form.Check
                  inline
                  type="radio"
                  name="appBuildType"
                  label="from Repo"
                  checked={appBuildType === 'fromRepo'}
                  onChange={() => setAppBuildType('fromRepo')}
                />
                <Form.Check
                  inline
                  type="radio"
                  name="appBuildType"
                  label="from Docker Image"
                  checked={appBuildType === 'fromDockerImage'}
                  onChange={() => setAppBuildType('fromDockerImage')}
                />
                <Form.Check
                  inline
                  type="radio"
                  name="appBuildType"
                  label="from Directory"
                  checked={appBuildType === 'fromLocalDirectory'}
                  onChange={() => setAppBuildType('fromLocalDirectory')}
                />
              </Form.Group>
              {appBuildType === 'fromRepo' && (
                <Form.Group className="mb-3">
                  <Form.Label>From repository *</Form.Label>
                  <Row>
                    <Col xs={9}>
                      <Form.Control
                        type="text"
                        required
                        value={appRepoURL}
                        onChange={e => setAppRepoURL(e.currentTarget.value)}
                      />
                    </Col>
                    <Col>
                      <InputGroup className="mb-3">
                        <InputGroup.Text>Rev</InputGroup.Text>
                        <Form.Control
                          type="text"
                          value={revision}
                          disabled={appRepoURL === undefined}
                          onChange={e => setRevision(e.currentTarget.value)}
                        />
                      </InputGroup>
                    </Col>
                  </Row>
                </Form.Group>
              )}
              {appBuildType === 'fromDockerImage' && (
                <Form.Group className="mb-3">
                  <Form.Label>From docker image *</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={appImage}
                    onChange={e => setAppImage(e.currentTarget.value)}
                  />
                </Form.Group>
              )}
              {appBuildType === 'fromLocalDirectory' && (
                <Form.Group className="mb-3">
                  <Form.Label>From directory *</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={appDir}
                    onChange={e => setAppDir(e.currentTarget.value)}
                  />
                </Form.Group>
              )}
              <h3>App Type</h3>
              <Form.Group className="mb-3">
                <Form.Check
                  inline
                  type="radio"
                  name="appType"
                  label="voila"
                  checked={appType === 'voila'}
                  onChange={() => setAppType('voila')}
                />
                <Form.Check
                  inline
                  type="radio"
                  name="appType"
                  label="streamlit"
                  checked={appType === 'streamlit'}
                  onChange={() => setAppType('streamlit')}
                />
                <Form.Check
                  inline
                  type="radio"
                  name="appType"
                  label="jupyterlab"
                  checked={appType === 'jupyterlab'}
                  onChange={() => setAppType('jupyterlab')}
                />
              </Form.Group>
              {appType === 'voila' && (
                <Form.Group className="mb-3">
                  <Form.Label>Notebook name</Form.Label>
                  <Form.Control
                    type="text"
                    value={notebookName}
                    onChange={e => setNotebookName(e.currentTarget.value)}
                  />
                </Form.Group>
              )}
              {appType === 'streamlit' && (
                <Form.Group className="mb-3">
                  <Form.Label>Python file name</Form.Label>
                  <Form.Control
                    type="text"
                    value={pythonFileName}
                    onChange={e => setPythonFileName(e.currentTarget.value)}
                  />
                </Form.Group>
              )}
              <h3>Resources</h3>
              <Form.Group className="mb-3">
                <Form.Label>CPU {cpuLimit}m</Form.Label>
                <Form.Range
                  value={cpuLimit}
                  min="50"
                  max="4000"
                  step="50"
                  onChange={e => setCpuLimit(parseInt(e.currentTarget.value))}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>MEM {memLimit}Gi</Form.Label>
                <Form.Range
                  value={memLimit}
                  min="1"
                  max="20"
                  step="1"
                  onChange={e => setMemLimit(parseInt(e.currentTarget.value))}
                />
              </Form.Group>
            </Form.Group>
            <Row>
              <Col xs={3}>
                {createdApp ? (
                  <Button disabled={true} style={submitButtonStyle}>
                    <Spinner as="span" animation="grow" size="sm" />
                  </Button>
                ) : (
                  <Form.Control
                    style={submitButtonStyle}
                    type="submit"
                    value={existedApp ? 'Update' : 'Create'}
                  />
                )}
              </Col>
              <Col>
                {showMessage && (
                  <Alert
                    variant="info"
                    onClose={() => setShowMessage(false)}
                    dismissible
                  >
                    <div dangerouslySetInnerHTML={{ __html: message }} />
                  </Alert>
                )}
              </Col>
            </Row>
          </Form>
        </Tab>
        <Tab eventKey="handle" title="Handle services">
          <ListeServices reload={tabKey} />
        </Tab>
      </Tabs>
    </div>
  );
};

const ListeServices: React.FC<{ reload: string }> = ({ reload }) => {
  const [services, setServices] = React.useState([]);
  const [message, setMessage] = React.useState('');
  const [showMessage, setShowMessage] = React.useState(false);
  const [deletedService, setDeletedService] = React.useState('');

  const getServices = () => {
    requestAPI<any>('services', {
      method: 'POST'
    })
      .then(reply => {
        setServices(reply.services);
      })
      .catch(reason => {
        console.error(
          `Error on POST /jupyterlab-onyxia-composer/services.\n${reason}`
        );
      });
    setShowMessage(false);
    setMessage('');
  };

  React.useEffect(() => {
    getServices();
  }, [reload]);

  const deleteService = (servName: string) => {
    setDeletedService(servName);
    requestAPI<any>('delete', {
      body: JSON.stringify({ service: servName }),
      method: 'POST'
    })
      .then(reply => {
        setMessage(reply.message);
        setShowMessage(true);
        setDeletedService('');
        getServices();
      })
      .catch(reason => {
        console.error(
          `Error on POST /jupyterlab-onyxia-composer/delete.\n${reason}`
        );
      });
  };

  return (
    <div className="container" style={{ margin: '1em' }}>
      <Table bordered size="sm">
        <thead>
          <tr>
            <th>Service Name</th>
            <th>Description</th>
            <th>Last Tag</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(services).map(([serviceName, service]) => (
            <tr>
              <td>{serviceName}</td>
              <td>{service['description']}</td>
              <td>{service['tag']}</td>
              <td>
                {serviceName !== 'jupyter-composer' && (
                  <>
                    {deletedService === serviceName ? (
                      <Button variant="light" disabled>
                        <Spinner
                          as="span"
                          animation="grow"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                        />
                      </Button>
                    ) : (
                      <Button
                        variant="light"
                        size="sm"
                        onClick={() => deleteService(serviceName)}
                      >
                        <i className="fa fa-trash"></i>
                      </Button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {showMessage && (
        <Alert variant="info" onClose={() => setShowMessage(false)} dismissible>
          {message}
        </Alert>
      )}
    </div>
  );
};

export class OnyxiaWidget extends ReactWidget {
  constructor() {
    super();
    this.addClass('onyxia-ReactWidget');
  }

  render(): JSX.Element {
    return <OnyxiaComponent />;
  }
}
