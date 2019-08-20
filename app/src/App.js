import React from "react";
import {
  Platform,
  ScrollView,
  Switch,
  Text,
  SafeAreaView,
  View,
  ActivityIndicator,
  Modal
} from "react-native";
import Toast from "@remobile/react-native-toast";
import BluetoothSerial, {
  withSubscription
} from "react-native-bluetooth-serial-next";
import { Buffer } from "buffer";
import Button from "./components/Button";
import DeviceList from "./components/DeviceList";
import styles from "./styles";
import RNFetchBlob from 'react-native-fetch-blob';
import ModalDropdown from 'react-native-modal-dropdown';

const csv=require('csvtojson')

global.Buffer = Buffer;

this.fileList = []
this.museData = null
this.dataIndex = null
this.currSignals = null

class App extends React.Component {
  constructor(props) {
    super(props);
    this.events = null;
    this.state = {
      isEnabled: false,
      device: null,
      devices: [],
      scanning: false,
      processing: false,
      data: null,
      streaming: false,
      museSignals: {delta: 0, alpha: 0, beta:0, gamma:0, theta: 0}
    };
    // setInterval(() => {
    //     BluetoothSerial.read((data, subscription) => {
    //         // pass
    //       }, "\n");
    //   }, 1000);
  }

  async componentDidMount() {
    this.events = this.props.events;

    setInterval(this.streamMuseData, 1000);

    try {
      const [isEnabled, devices] = await Promise.all([
        BluetoothSerial.isEnabled(),
        BluetoothSerial.list()
      ]);

      this.setState({
        isEnabled,
        devices: devices.map(device => ({
          ...device,
          paired: true,
          connected: false
        }))
      });
      this.fileList = this.getFileNames()
    } catch (e) {
      Toast.showShortBottom(e.message);
    }

    this.events.on("bluetoothEnabled", () => {
      Toast.showShortBottom("Bluetooth enabled");
      this.setState({ isEnabled: true });
    });

    this.events.on("bluetoothDisabled", () => {
      Toast.showShortBottom("Bluetooth disabled");
      this.setState({ isEnabled: false });
    });

    this.events.on("connectionSuccess", ({ device }) => {
      if (device) {
        Toast.showShortBottom(
          `Device ${device.name}<${device.id}> has been connected`
        );
      }
    });

    this.events.on("connectionFailed", ({ device }) => {
      if (device) {
        Toast.showShortBottom(
          `Failed to connect with device ${device.name}<${device.id}>`
        );
      }
    });

    this.events.on("connectionLost", ({ device }) => {
      if (device) {
        Toast.showShortBottom(
          `Device ${device.name}<${device.id}> connection has been lost`
        );
        this.setState(({ device }) => ({
            device: {
              ...device,
              connected: false
            }
          }));
        this.connect(device.id)
      }
    });

    this.events.on("data", result => {
      if (result) {
        const { id, data } = result;
        Toast.showShortBottom(`Data from device ${id} : ${data}`);
      }
    });

    this.events.on("error", e => {
      if (e) {
        console.log(`Error: ${e.message}`);
        Toast.showShortBottom(e.message);
      }
    });
  }

  requestEnable = () => async () => {
    try {
      await BluetoothSerial.requestEnable();
      this.setState({ isEnabled: true });
    } catch (e) {
      Toast.showShortBottom(e.message);
    }
  };

  toggleBluetooth = async value => {
    try {
      if (value) {
        await BluetoothSerial.enable();
      } else {
        await BluetoothSerial.disable();
      }
    } catch (e) {
      Toast.showShortBottom(e.message);
    }
  };

  listDevices = async () => {
    try {
      const list = await BluetoothSerial.list();

      this.setState(({ devices }) => ({
        devices: devices.map(device => {
          const found = list.find(v => v.id === device.id);

          if (found) {
            return {
              ...found,
              paired: true,
              connected: false
            };
          }

          return device;
        })
      }));
    } catch (e) {
      Toast.showShortBottom(e.message);
    }
  };

  discoverUnpairedDevices = async () => {
    this.setState({ scanning: true });

    try {
      const unpairedDevices = await BluetoothSerial.listUnpaired();

      this.setState(({ devices }) => ({
        scanning: false,
        devices: devices
          .map(device => {
            const found = unpairedDevices.find(d => d.id === device.id);

            if (found) {
              return {
                ...device,
                ...found,
                connected: false,
                paired: false
              };
            }

            return device.paired || device.connected ? device : null;
          })
          .map(v => v)
      }));
    } catch (e) {
      Toast.showShortBottom(e.message);

      this.setState(({ devices }) => ({
        scanning: false,
        devices: devices.filter(device => device.paired || device.connected)
      }));
    }
  };

  cancelDiscovery = () => async () => {
    try {
      await BluetoothSerial.cancelDiscovery();
      this.setState({ scanning: false });
    } catch (e) {
      Toast.showShortBottom(e.message);
    }
  };

  toggleDevicePairing = async ({ id, paired }) => {
    if (paired) {
      await this.unpairDevice(id);
    } else {
      await this.pairDevice(id);
    }
  };

  pairDevice = async id => {
    this.setState({ processing: true });

    try {
      const paired = await BluetoothSerial.pairDevice(id);

      if (paired) {
        Toast.showShortBottom(
          `Device ${paired.name}<${paired.id}> paired successfully`
        );

        this.setState(({ devices, device }) => ({
          processing: false,
          device: {
            ...device,
            ...paired,
            paired: true
          },
          devices: devices.map(v => {
            if (v.id === paired.id) {
              return {
                ...v,
                ...paired,
                paired: true
              };
            }

            return v;
          })
        }));
      } else {
        Toast.showShortBottom(`Device <${id}> pairing failed`);
        this.setState({ processing: false });
      }
    } catch (e) {
      Toast.showShortBottom(e.message);
      this.setState({ processing: false });
    }
  };

  unpairDevice = async id => {
    this.setState({ processing: true });

    try {
      const unpaired = await BluetoothSerial.unpairDevice(id);

      if (unpaired) {
        Toast.showShortBottom(
          `Device ${unpaired.name}<${unpaired.id}> unpaired successfully`
        );

        this.setState(({ devices, device }) => ({
          processing: false,
          device: {
            ...device,
            ...unpaired,
            connected: false,
            paired: false
          },
          devices: devices.map(v => {
            if (v.id === unpaired.id) {
              return {
                ...v,
                ...unpaired,
                connected: false,
                paired: false
              };
            }

            return v;
          })
        }));
      } else {
        Toast.showShortBottom(`Device <${id}> unpairing failed`);
        this.setState({ processing: false });
      }
    } catch (e) {
      Toast.showShortBottom(e.message);
      this.setState({ processing: false });
    }
  };

  toggleDeviceConnection = async ({ id, connected }) => {
    if (connected) {
      await this.disconnect(id);
    } else {
      await this.connect(id);
    }
  };

  connect = async id => {
    this.setState({ processing: true });

    try {
      const connected = await BluetoothSerial.device(id).connect();

      if (connected) {
        Toast.showShortBottom(
          `Connected to device ${connected.name}<${connected.id}>`
        );

        this.setState(({ devices, device }) => ({
          processing: false,
          device: {
            ...device,
            ...connected,
            connected: true
          },
          devices: devices.map(v => {
            if (v.id === connected.id) {
              return {
                ...v,
                ...connected,
                connected: true
              };
            }

            return v;
          })
        }));
        this.fileList = this.getFileNames()
      } else {
        Toast.showShortBottom(`Failed to connect to device <${id}>`);
        this.setState({ processing: false });
      }
    } catch (e) {
      Toast.showShortBottom(e.message);
      this.setState({ processing: false });
    }
  };

  disconnect = async id => {
    this.setState({ processing: true });

    try {
      await BluetoothSerial.device(id).disconnect();

      this.setState(({ devices, device }) => ({
        processing: false,
        device: {
          ...device,
          connected: false
        },
        devices: devices.map(v => {
          if (v.id === id) {
            return {
              ...v,
              connected: false
            };
          }

          return v;
        })
      }));
    } catch (e) {
      Toast.showShortBottom(e.message);
      this.setState({ processing: false });
    }
  };

  write = async (id, msg) => {
    try {
      await BluetoothSerial.device(id).write(msg);
      Toast.showShortBottom(`Successfuly wrote ${msg} to device`);
    } catch (e) {
      Toast.showShortBottom(e.message);
    }
  };

  getFileNames = async () => {
    RNFetchBlob.fetch('POST', 'https://api.dropboxapi.com/2/files/list_folder', {
        Authorization : "Bearer E1N5CzZaZGAAAAAAAAABxJttik1C4KzIT1aIj9z6SZuL4Te13B88O-yLcyEwCq-r",
        'Content-Type' : 'application/json',
      }, JSON.stringify({
        path : '',
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
        include_mounted_folders: false,
        include_non_downloadable_files: false
    }))
      .then((res) => {
        var museFiles = []
        var entries = JSON.parse(res.data)['entries']
        for(var i in entries){
            var name = entries[i]['name']
            if (name.startsWith('museMonitor') && name.endsWith('.csv')){
                museFiles.push(name)
                console.log(entries[i])
            }
        }
        this.fileList = museFiles
      })
      .catch((err) => {
        console.log(err.message, err.code);
      })
  };

  getMuseData = async (index, fileName) => {
    RNFetchBlob.fetch('POST', 'https://content.dropboxapi.com/2/files/download', {
        Authorization : "Bearer E1N5CzZaZGAAAAAAAAABxJttik1C4KzIT1aIj9z6SZuL4Te13B88O-yLcyEwCq-r",
        'Dropbox-API-Arg': JSON.stringify({
          path : '/'+fileName,
        }),
        'Content-Type' : 'application/octet-stream',
    })
      .then((res) => {
        csv({output: "json"})
        .fromString(res.data)
        .then((json)=>{ 
            this.museData = json
            this.setState({streaming: true})
            this.dataIndex = 0
        })
      })
      .catch((err) => {
        console.log(err.message, err.code);
      })
  }

  streamMuseData = async () => {
    
    if (this.state.streaming){
        id = this.state.device.id
        var currData = this.museData[this.dataIndex]

        var delta = (parseFloat(currData["Delta_AF7"]) +
            parseFloat(currData["Delta_AF8"])+
            parseFloat(currData["Delta_TP9"])+
            parseFloat(currData["Delta_TP10"]))/4 
        if(delta < 0.39 && delta > 0.34){
            this.write(id, 'd')
            Toast.showShortBottom("Signalled Delta")
        }
        var theta = (parseFloat(currData["Theta_AF7"]) +
            parseFloat(currData["Theta_AF8"])+
            parseFloat(currData["Theta_TP9"])+
            parseFloat(currData["Theta_TP10"]))/4 
        if(theta < 0.27 && theta > 0.22){
            this.write(id, 't')
            Toast.showShortBottom("Signalled Theta")
        }
        var alpha = (parseFloat(currData["Alpha_AF7"]) +
            parseFloat(currData["Alpha_AF8"])+
            parseFloat(currData["Alpha_TP9"])+
            parseFloat(currData["Alpha_TP10"]))/4 
        if(alpha < 0.78 && alpha > 0.73){
            this.write(id, 'a')
            Toast.showShortBottom("Signalled Alpha")
        }
        var beta = (parseFloat(currData["Beta_AF7"]) +
            parseFloat(currData["Beta_AF8"])+
            parseFloat(currData["Beta_TP9"])+
            parseFloat(currData["Beta_TP10"]))/4 
        if(beta < 0.33 && beta > 0.28){
            this.write(id, 'b')
            Toast.showShortBottom("Signalled Beta")
        }
        var gamma = (parseFloat(currData["Gamma_AF7"]) +
            parseFloat(currData["Gamma_AF8"])+
            parseFloat(currData["Gamma_TP9"])+
            parseFloat(currData["Gamma_TP10"]))/4 
        if(gamma < 0.12 && gamma > 0.07){
            this.write(id, 'g')
            Toast.showShortBottom("Signalled Gamma")
        }
        

        this.setState({museSignals: {delta, theta, alpha, gamma, beta}})
        this.dataIndex = this.dataIndex + 1
    }
  }

  

  renderModal = (device, processing) => {
    if (!device) return null;

    const { id, name, paired, connected } = device;

    return (
      <Modal
        animationType="fade"
        transparent={false}
        visible={true}
        onRequestClose={() => {}}
      >
        {device ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center"
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>{name}</Text>
            <Text style={{ fontSize: 14 }}>{`<${id}>`}</Text>

            {processing && (
              <ActivityIndicator
                style={{ marginTop: 15 }}
                size={Platform.OS === "ios" ? 1 : 60}
              />
            )}

            {!processing && (
              <View style={{ marginTop: 20, width: "80%" }}>
                {Platform.OS !== "ios" && (
                  <Button
                    title={paired ? "Unpair" : "Pair"}
                    style={{
                      backgroundColor: "#22509d"
                    }}
                    textStyle={{ color: "#fff" }}
                    onPress={() => this.toggleDevicePairing(device)}
                  />
                )}
                <Button
                  title={connected ? "Disconnect" : "Connect"}
                  style={{
                    backgroundColor: "#22509d"
                  }}
                  textStyle={{ color: "#fff" }}
                  onPress={() => this.toggleDeviceConnection(device)}
                />
                {connected && (
                  <React.Fragment>
                    <ModalDropdown 
                        options={this.fileList} 
                        onSelect={this.getMuseData} 
                        defaultValue={"Please choose the MUSE csv file"}
                        style={styles.button}
                    />
                   <Button
                      title="Write b"
                      style={{
                        backgroundColor: "#22509d"
                      }}
                      textStyle={{ color: "#fff" }}
                      onPress={() => this.write(id, 'b')}
                    />
                    <Button
                      title="Write t"
                      style={{
                        backgroundColor: "#22509d"
                      }}
                      textStyle={{ color: "#fff" }}
                      onPress={() => this.write(id, 't')}
                    />
                    
                    {this.state.streaming && (
                        <View>
                            <Text >Delta: {this.state.museSignals.delta}</Text>
                            <Text >Theta: {this.state.museSignals.theta}</Text>
                            <Text >Gamma: {this.state.museSignals.gamma}</Text>
                            <Text >Alpha: {this.state.museSignals.alpha}</Text>
                            <Text >Beta: {this.state.museSignals.beta}</Text>
                        </View>
                    )}
                  </React.Fragment>
                )} 
                <Button
                  title="Close"
                  onPress={() => this.setState({ device: null, streaming:false })}
                />
            </View>
            )}
          </View>
        ) : null}
      </Modal>
    );
  };

  render() {
    const { isEnabled, device, devices, scanning, processing } = this.state;

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <Text style={styles.heading}>Bluetooth Example</Text>
          <View style={styles.enableInfoWrapper}>
            <Text style={{ fontSize: 14, color: "#fff", paddingRight: 10 }}>
              {isEnabled ? "ON" : "OFF"}
            </Text>
            <Switch onValueChange={this.toggleBluetooth} value={isEnabled} />
          </View>
        </View>

        {scanning ? (
          isEnabled && (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <ActivityIndicator
                style={{ marginBottom: 15 }}
                size={Platform.OS === "ios" ? 1 : 60}
              />
              <Button
                textStyle={{ color: "#fff" }}
                style={styles.buttonRaised}
                title="Cancel Discovery"
                onPress={this.cancelDiscovery}
              />
            </View>
          )
        ) : (
          <React.Fragment>
            {this.renderModal(device, processing)}
            <DeviceList
              devices={devices}
              onDevicePressed={device => this.setState({ device })}
              onRefresh={this.listDevices}
            />
          </React.Fragment>
        )}

        <View style={styles.footer}>
          <ScrollView horizontal contentContainerStyle={styles.fixedFooter}>
            {isEnabled && (
              <Button
                title="Discover more"
                onPress={this.discoverUnpairedDevices}
              />
            )}
            {!isEnabled && (
              <Button title="Request enable" onPress={this.requestEnable} />
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }
}

export default withSubscription({ subscriptionName: "events" })(App);
